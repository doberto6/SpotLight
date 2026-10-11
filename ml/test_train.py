import unittest
import math
import pandas as pd
import numpy as np
from train import chronological_split,validate_features,audit_history,pipeline,inputs,NUMERIC
from predict import risk_category,explain

class TrainingTests(unittest.TestCase):
    def test_whole_missions_and_chronology(self):
        rows=[]
        for n in range(10):
            for i in range(2):
                rows.append({'mission_id':f'M{n:03}','action_at':f'2026-09-{n+1:02}T12:0{i}:00Z','cutoff_at':f'2026-09-{n+1:02}T11:00:00Z','label':i})
        train,test=chronological_split(pd.DataFrame(rows))
        self.assertEqual((len(train),len(test)),(16,4))
        self.assertFalse(set(train.mission_id)&set(test.mission_id))
        self.assertLess(train.action_at.max(),test.action_at.min())

    def test_probability_validation(self):
        for invalid in [float('nan'),float('inf'),-.1,1.1]:
            with self.assertRaises(ValueError):risk_category(invalid)
        self.assertEqual(risk_category(.30),'Elevated')
        self.assertEqual(risk_category(.15),'Watch')
        self.assertEqual(risk_category(0),'Lower')

    def test_history_excludes_same_mission_equal_time_and_unfinished_outcomes(self):
        frame=pd.DataFrame([{'target_id':'test','target_kind':'training','mission_id':'M002','cutoff_at':'2026-09-02T10:00:00Z','location_id':'WP01','asset_id':'A1','action_type':'THERMAL','configuration_version':'V1','location_n':1,'asset_n':1,'type_n':1,'location_rate':1.0,'asset_rate':1.0,'type_rate':1.0,'configuration_rate':1.0}])
        def event(mid,time,end,label):return {'mission_id':mid,'outcome_at':time,'mission_end':end,'location_id':'WP01','asset_id':'A1','action_type':'THERMAL','configuration_version':'V1','label':label}
        history=[event('M001','2026-09-01T11:00:00Z','2026-09-01T12:00:00Z',1),event('M002','2026-09-02T09:00:00Z','2026-09-02T09:30:00Z',0),event('M003','2026-09-02T10:00:00Z','2026-09-02T10:00:00Z',0),event('M004','2026-09-02T09:00:00Z','2026-09-02T11:00:00Z',0)]
        audit_history(frame,history)
        frame.loc[0,'location_n']=2
        with self.assertRaisesRegex(ValueError,'prior-only audit'):audit_history(frame,history)

    def test_current_or_future_evidence_is_rejected(self):
        frame=pd.DataFrame([dict(target_kind='training',label=n,action_id=f'A{n}',cutoff_at='2026-09-02',history_last_outcome='2026-09-02',history_last_mission_end='2026-09-01',**{k:0 for k in NUMERIC}) for n in [0,1]])
        with self.assertRaisesRegex(ValueError,'unavailable'):validate_features(frame)

    def test_contributions_reconstruct_actual_trained_probability(self):
        rows=[]
        for n in range(20):
            rows.append(dict(location_id='WP01',asset_id='A1',asset_type='PUMP',action_type='THERMAL',configuration_version='V1',environment='NOISE',**{k:n%5 for k in NUMERIC}))
        frame=inputs(pd.DataFrame(rows));model=pipeline().fit(frame,np.array([0,0,1,0,0]*4))
        from train import CATEGORICAL
        explanation=explain(model,frame,CATEGORICAL,NUMERIC)[0]
        logit=explanation['intercept']+sum(f['contribution'] for f in explanation['factors'])
        self.assertAlmostEqual(1/(1+math.exp(-logit)),model.predict_proba(frame)[0,1],places=12)

if __name__=='__main__':unittest.main()
