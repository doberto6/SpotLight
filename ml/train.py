"""Read Databricks SQL features, evaluate chronologically, refit, batch predict.

No server or secrets. scripts/ml-run.mjs handles SQL extraction/publication.
"""
import argparse
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (precision_score,recall_score,confusion_matrix,
                             roc_auc_score,average_precision_score,brier_score_loss)
from predict import forecasts

CATEGORICAL=['location_id','asset_id','asset_type','action_type','configuration_version','environment']
NUMERIC=['inspection_hour','location_n','location_rate','asset_n','asset_rate','type_n','type_rate','configuration_rate']
THRESHOLD=.30  # Predefined review threshold; never optimized on the holdout.

def validate_features(frame):
    training=frame[frame.target_kind=='training']
    if training.empty or not set(training.label.dropna().astype(int))=={0,1}:
        raise ValueError('Need both failed and successful actions to train')
    if training.action_id.duplicated().any():
        raise ValueError('Duplicate action IDs or join fanout')
    for column in ['history_last_outcome','history_last_mission_end']:
        history=pd.to_datetime(frame[column],utc=True,errors='coerce')
        cutoff=pd.to_datetime(frame.cutoff_at,utc=True,errors='raise')
        if (history.notna() & (history>=cutoff)).any():
            raise ValueError('History includes information unavailable at prediction time')
    if frame[NUMERIC].isna().any().any() or not np.isfinite(frame[NUMERIC].astype(float)).all().all():
        raise ValueError('Features must be finite and non-null')
    if frame[frame.target_kind=='forecast'].label.notna().any():
        raise ValueError('Forecast candidates cannot have outcomes')

def audit_history(frame,history):
    """Independently verify SQL aggregates against the extracted eligible rows."""
    events=pd.DataFrame(history)
    for column in ['outcome_at','mission_end']:
        events[column]=pd.to_datetime(events[column],utc=True)
    for row in frame.itertuples():
        cutoff=pd.to_datetime(row.cutoff_at,utc=True)
        prior=events[(events.outcome_at<cutoff)&(events.mission_end<cutoff)]
        if row.target_kind=='training':
            prior=prior[prior.mission_id!=row.mission_id]
        for prefix,column,value in [('location','location_id',row.location_id),('asset','asset_id',row.asset_id),('type','action_type',row.action_type)]:
            subset=prior[prior[column]==value]
            rate=float(subset.label.mean()) if len(subset) else 0.0
            if int(getattr(row,prefix+'_n'))!=len(subset) or not np.isclose(getattr(row,prefix+'_rate'),rate):
                raise ValueError(f'SQL historical features disagree with prior-only audit: {row.target_id}/{prefix}')
        subset=prior[prior.configuration_version==row.configuration_version]
        if not np.isclose(row.configuration_rate,float(subset.label.mean()) if len(subset) else 0.0):
            raise ValueError('Configuration history failed temporal audit')

def chronological_split(frame):
    missions=frame.groupby('mission_id').cutoff_at.min().sort_values(kind='stable').index.tolist()
    if len(missions)<5:
        raise ValueError('At least five missions required for a mission-based holdout')
    count=max(1,math.ceil(len(missions)*.20))
    train=frame[frame.mission_id.isin(missions[:-count])].copy()
    test=frame[frame.mission_id.isin(missions[-count:])].copy()
    if pd.to_datetime(train.action_at,utc=True).max()>=pd.to_datetime(test.action_at,utc=True).min():
        raise ValueError('Overlapping missions cannot support this chronological split')
    if train.label.nunique()<2:
        raise ValueError('Training missions do not contain both labels')
    return train,test

def inputs(frame):
    result=frame[CATEGORICAL+NUMERIC].copy()
    result[CATEGORICAL]=result[CATEGORICAL].fillna('UNKNOWN').astype(str)
    result[NUMERIC]=result[NUMERIC].astype(float)
    return result

def pipeline():
    return Pipeline([
        ('preprocess',ColumnTransformer([
            ('categories',OneHotEncoder(handle_unknown='ignore',sparse_output=False),CATEGORICAL),
            ('numbers',StandardScaler(),NUMERIC),
        ])),
        ('model',LogisticRegression(C=.25,max_iter=2000,random_state=42)),
    ])

def evaluate(y,probability):
    predicted=probability>=THRESHOLD
    both=len(set(y))==2
    return {'sample_count':len(y),'failure_count':int(sum(y)),
            'failure_prevalence':float(np.mean(y)),
            'precision':float(precision_score(y,predicted,zero_division=0)),
            'recall':float(recall_score(y,predicted,zero_division=0)),
            'confusion_matrix':confusion_matrix(y,predicted,labels=[0,1]).tolist(),
            'roc_auc':float(roc_auc_score(y,probability)) if both else None,
            'pr_auc':float(average_precision_score(y,probability)) if both else None,
            'brier_score':float(brier_score_loss(y,probability)),
            'threshold':THRESHOLD,
            'metric_note':'ROC/PR-AUC need both labels; PR-AUC is average precision.'}

def train(document,outdir):
    frame=pd.DataFrame(document['rows'])
    validate_features(frame)
    audit_history(frame,document['history'])
    training=frame[frame.target_kind=='training'].copy()
    candidates=frame[frame.target_kind=='forecast'].copy()
    if candidates.empty:
        raise ValueError('No known inspection combinations to forecast')
    train_rows,test_rows=chronological_split(training)
    model=pipeline().fit(inputs(train_rows),train_rows.label.astype(int))
    y=test_rows.label.astype(int).to_numpy()
    evaluation=evaluate(y,model.predict_proba(inputs(test_rows))[:,1])
    prevalence=float(train_rows.label.astype(int).mean())
    baseline=evaluate(y,np.full(len(y),prevalence))
    # Fixed regularization + empirical prevalence retain the observed imbalance.
    # No class balancing that would inflate uncalibrated probability estimates.
    model.fit(inputs(training),training.label.astype(int))
    now=datetime.now(timezone.utc).isoformat()
    fingerprint=hashlib.sha256(json.dumps(document['rows'],sort_keys=True).encode()).hexdigest()
    version='lr-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')+'-'+fingerprint[:8]
    predictions=forecasts(model,inputs(candidates),candidates.reset_index(drop=True),CATEGORICAL,NUMERIC,version)
    metrics={
        'model_version':version,'model_type':'L2 logistic regression','experimental':True,
        'trained_at':now,'training_environment':'Local Python / scikit-learn',
        'features':CATEGORICAL+NUMERIC,'training_count':len(train_rows),'test_count':len(test_rows),
        'refit_count':len(training),'training_missions':int(train_rows.mission_id.nunique()),
        'test_missions':int(test_rows.mission_id.nunique()),'candidate_count':len(predictions),
        'evaluation':evaluation,'baseline':baseline,'baseline_probability':prevalence,
        'data_cutoff':str(candidates.cutoff_at.iloc[0]),'data_fingerprint':fingerprint,
        'source_signature':document['source_signature'],'source_tables':document['source_tables'],
        'data_audit':document['audit'],'training_start':str(train_rows.action_at.min()),
        'training_end':str(train_rows.action_at.max()),'test_start':str(test_rows.action_at.min()),
        'test_end':str(test_rows.action_at.max()),'dependencies':{'sklearn':sklearn.__version__,'numpy':np.__version__,'pandas':pd.__version__},
        'assumptions':'Repeat each observed waypoint/asset/action combination using the latest observed configuration and its last observed hour. No future mission plan is available.',
        'validation_note':'Last 20% of missions held out. History updates with earlier completed holdout missions, without refitting. Final forecast model refit on all eligible actions.',
        'limitations':['Synthetic challenge data; inspection action failure is not equipment failure.',
                      'Small chronological holdout; scores are not calibrated real-world probabilities.',
                      'Coefficient associations do not establish why an incident happened.',
                      'Historical waypoint rate pools configurations and action types; each forecast is a specific candidate.'],
    }
    outdir.mkdir(parents=True,exist_ok=True)
    joblib.dump(model,outdir/'model.joblib')
    (outdir/'results.json').write_text(json.dumps({'metrics':metrics,'predictions':predictions},allow_nan=False,indent=2),encoding='utf8')
    print(json.dumps({'model_version':version,'train':len(train_rows),'test':len(test_rows),'candidates':len(predictions),'evaluation':evaluation,'baseline':baseline}))
    return metrics,predictions

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--input',required=True)
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    train(json.loads(Path(args.input).read_text(encoding='utf8')),Path(args.output))
