"""Batch forecasts and exact additive logistic-model explanations."""
import math
import numpy as np

def risk_category(probability):
    if not math.isfinite(probability) or not 0 <= probability <= 1:
        raise ValueError('Invalid predicted probability')
    return 'Elevated' if probability >= .30 else 'Watch' if probability >= .15 else 'Lower'

def explain(model, frame, categorical, numeric):
    pre=model.named_steps['preprocess']
    transformed=pre.transform(frame)
    coefficients=model.named_steps['model'].coef_[0]
    encoder=pre.named_transformers_['categories']
    groups=[name for name,values in zip(categorical,encoder.categories_) for _ in values]+numeric
    results=[]
    for values in transformed:
        sums={name:0.0 for name in categorical+numeric}
        for name,value in zip(groups,values*coefficients):
            sums[name]+=float(value)
        factors=sorted([{'feature':name,'value':str(frame.iloc[len(results)][name]),
                         'contribution':amount,'direction':'Raises estimate' if amount>0 else 'Lowers estimate'}
                        for name,amount in sums.items() if abs(amount)>1e-8],
                       key=lambda x:abs(x['contribution']),reverse=True)
        results.append({'intercept':float(model.named_steps['model'].intercept_[0]),
                        'log_odds':float(np.sum(values*coefficients)+model.named_steps['model'].intercept_[0]),
                        'factors':factors})
    return results

def forecasts(model, frame, raw, categorical, numeric, version):
    probabilities=model.predict_proba(frame)[:,1]
    explanations=explain(model,frame,categorical,numeric)
    rows=[]
    for i,probability in enumerate(probabilities):
        record=raw.iloc[i]
        band=risk_category(float(probability))
        rows.append({
            'target_id':record.target_id,'location_id':record.location_id,
            'location_name':record.location_name,'floor':int(record.floor),
            'asset_id':record.asset_id,'asset_name':record.asset_name,'asset_type':record.asset_type,
            'action_type':record.action_type,'configuration_version':record.configuration_version,
            'assumed_hour':int(record.inspection_hour),'predicted_failure_probability':float(probability),
            'risk_category':band,'historical_failure_rate':float(record.location_rate),
            'historical_sample_size':int(record.location_n),'historical_failures':int(record.location_failed),
            'asset_sample_size':int(record.asset_n),'asset_failures':int(record.asset_failed),
            'model_version':version,'data_cutoff':str(record.cutoff_at),
            'explanation':explanations[i],
            'recommended_action':('Review prior failed inspections and consider a targeted reinspection.'
                                  if band=='Elevated' else 'Review inspection conditions before scheduling.'
                                  if band=='Watch' else 'Keep the inspection on the normal review schedule.'),
        })
    return sorted(rows,key=lambda r:(-r['predicted_failure_probability'],r['target_id']))
