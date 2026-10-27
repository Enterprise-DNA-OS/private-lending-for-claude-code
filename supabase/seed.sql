-- Fictional demo book for a small New Zealand private lender. Dates are relative to the day you seed.
-- Idempotent: every row has a fixed id or key and is skipped when it already exists.
begin;
insert into borrowers(id,code,name,entity_type,contact,email,kyc_verified_on,kyc_method) values
('10000000-0000-4000-8000-000000000001','BR-HARB','Harbourview Holdings Ltd','company','Rachel Ngata','demo-harbourview@example.com',current_date-210,'Electronic verification, two directors'),
('10000000-0000-4000-8000-000000000002','BR-KAURI','Kauri Ridge Developments Ltd','company','Tom Whitcombe','demo-kauri@example.com',current_date-170,'Certified passport copies'),
('10000000-0000-4000-8000-000000000003','BR-MOANA','Moana Family Trust','trust','Sione Taufa','demo-moana@example.com',current_date-100,'Trust deed and trustee identity'),
('10000000-0000-4000-8000-000000000004','BR-SOUTH','Southern Yards Ltd','company','Grace Bell','demo-southern@example.com',current_date-800,'Electronic verification'),
('10000000-0000-4000-8000-000000000005','BR-TASMAN','Tasman Fitout Ltd','company','Liam Doyle','demo-tasman@example.com',null,''),
('10000000-0000-4000-8000-000000000006','BR-RIDGE','Ridgeline Storage Ltd','company','Priya Shah','demo-ridgeline@example.com',current_date-520,'Electronic verification')
on conflict do nothing;

insert into investors(id,code,name,investor_type,certificate_on,kyc_verified_on,email) values
('20000000-0000-4000-8000-000000000001','INV-01','Pohutukawa Super Fund','wholesale',current_date-300,current_date-300,'demo-pohutukawa@example.com'),
('20000000-0000-4000-8000-000000000002','INV-02','Lee Family Office','sophisticated',current_date-800,current_date-800,'demo-lee@example.com'),
('20000000-0000-4000-8000-000000000003','INV-03','Ridgeway Nominees Ltd','wholesale',current_date-100,null,'demo-ridgeway@example.com'),
('20000000-0000-4000-8000-000000000004','INV-04','Anna Patel','retail',null,current_date-50,'demo-patel@example.com')
on conflict do nothing;

insert into loans(id,code,borrower_id,purpose,loan_type,status,limit_cents,rate_bps,default_rate_bps,repayment,max_lvr_bps,currency,settled_on,maturity_on,interest_to,business_purpose_on,manager,reviewed_on) values
('30000000-0000-4000-8000-000000000001','PL-101','10000000-0000-4000-8000-000000000001','Refinance of a commercial building','term','settled',120000000,995,1495,'interest_only',7500,'NZD',current_date-200,current_date+40,current_date-20,current_date-205,'Mia',current_date-200),
('30000000-0000-4000-8000-000000000002','PL-102','10000000-0000-4000-8000-000000000002','Six-unit townhouse build','construction','settled',350000000,1150,1650,'capitalised',7000,'NZD',current_date-150,current_date+210,current_date-30,current_date-155,'Jon',current_date-150),
('30000000-0000-4000-8000-000000000003','PL-103','10000000-0000-4000-8000-000000000003','Bridging finance pending sale','bridging','settled',65000000,1250,1850,'interest_only',7000,'NZD',current_date-95,current_date-10,current_date-35,null,'Jon',current_date-95),
('30000000-0000-4000-8000-000000000004','PL-104','10000000-0000-4000-8000-000000000004','Industrial land purchase','land','settled',90000000,1050,1550,'interest_only',6500,'NZD',current_date-420,current_date+60,current_date-30,current_date-425,'Mia',current_date-420),
('30000000-0000-4000-8000-000000000005','PL-105','10000000-0000-4000-8000-000000000005','Working capital against a warehouse','term','approved',45000000,1095,1595,'interest_only',7000,'NZD',null,null,null,current_date-3,'Mia',current_date-3),
('30000000-0000-4000-8000-000000000006','PL-106','10000000-0000-4000-8000-000000000006','Storage site acquisition','term','discharged',50000000,1000,1500,'interest_only',7000,'NZD',current_date-500,current_date-60,current_date-60,current_date-505,'Jon',current_date-500)
on conflict do nothing;

insert into securities(id,code,loan_id,address,security_type,market_value_cents,complete_value_cents,valued_on,valuer,valuer_independent,insurance_expires_on) values
('40000000-0000-4000-8000-000000000001','SEC-101','30000000-0000-4000-8000-000000000001','14 Marine Parade, Mount Maunganui','first_mortgage',210000000,null,current_date-210,'Bay Valuers Ltd',true,current_date+12),
('40000000-0000-4000-8000-000000000002','SEC-102','30000000-0000-4000-8000-000000000002','40 Kauri Ridge Road, Silverdale','first_mortgage',180000000,460000000,current_date-160,'North Shore Valuation Co',true,current_date+120),
('40000000-0000-4000-8000-000000000003','SEC-103','30000000-0000-4000-8000-000000000003','22 Tui Street, Ponsonby','first_mortgage',98000000,null,current_date-100,'City Property Valuers',true,current_date-5),
('40000000-0000-4000-8000-000000000004','SEC-104','30000000-0000-4000-8000-000000000004','Lot 3 Hornby Industrial Park, Christchurch','first_mortgage',150000000,null,current_date-430,'Director estimate',false,current_date+200),
('40000000-0000-4000-8000-000000000005','SEC-105','30000000-0000-4000-8000-000000000005','8 Wharf Road, Nelson','first_mortgage',72000000,null,current_date-20,'Top of the South Valuers',true,current_date+300),
('40000000-0000-4000-8000-000000000006','SEC-106','30000000-0000-4000-8000-000000000006','5 Quarry Lane, Rolleston','first_mortgage',90000000,null,current_date-510,'Canterbury Valuers',true,current_date-60)
on conflict do nothing;

insert into ledger(loan_id,posted_on,kind,amount_cents,period_from,period_to,evidence,note,event_key) values
-- PL-101: drawn in full, interest charged monthly and paid two days later.
('30000000-0000-4000-8000-000000000001',current_date-200,'drawdown',120000000,null,null,'Settlement statement','Settlement','DEMO-PL101-DD1'),
('30000000-0000-4000-8000-000000000001',current_date-170,'interest',981370,current_date-200,current_date-170,'','','DEMO-PL101-I1'),
('30000000-0000-4000-8000-000000000001',current_date-168,'payment',981370,null,null,'','Direct credit','DEMO-PL101-P1'),
('30000000-0000-4000-8000-000000000001',current_date-140,'interest',981370,current_date-170,current_date-140,'','','DEMO-PL101-I2'),
('30000000-0000-4000-8000-000000000001',current_date-138,'payment',981370,null,null,'','Direct credit','DEMO-PL101-P2'),
('30000000-0000-4000-8000-000000000001',current_date-110,'interest',981370,current_date-140,current_date-110,'','','DEMO-PL101-I3'),
('30000000-0000-4000-8000-000000000001',current_date-108,'payment',981370,null,null,'','Direct credit','DEMO-PL101-P3'),
('30000000-0000-4000-8000-000000000001',current_date-80,'interest',981370,current_date-110,current_date-80,'','','DEMO-PL101-I4'),
('30000000-0000-4000-8000-000000000001',current_date-78,'payment',981370,null,null,'','Direct credit','DEMO-PL101-P4'),
('30000000-0000-4000-8000-000000000001',current_date-50,'interest',981370,current_date-80,current_date-50,'','','DEMO-PL101-I5'),
('30000000-0000-4000-8000-000000000001',current_date-48,'payment',981370,null,null,'','Direct credit','DEMO-PL101-P5'),
('30000000-0000-4000-8000-000000000001',current_date-20,'interest',981370,current_date-50,current_date-20,'','','DEMO-PL101-I6'),
('30000000-0000-4000-8000-000000000001',current_date-18,'payment',981370,null,null,'','Direct credit','DEMO-PL101-P6'),
-- PL-102: staged construction draws, interest added to the balance. Draw 3 has no progress evidence.
('30000000-0000-4000-8000-000000000002',current_date-150,'drawdown',90000000,null,null,'QS report 1: land settlement','Draw 1','DEMO-PL102-DD1'),
('30000000-0000-4000-8000-000000000002',current_date-120,'interest',850685,current_date-150,current_date-120,'','Capitalised','DEMO-PL102-I1'),
('30000000-0000-4000-8000-000000000002',current_date-90,'drawdown',60000000,null,null,'QS report 2: foundations complete','Draw 2','DEMO-PL102-DD2'),
('30000000-0000-4000-8000-000000000002',current_date-90,'interest',858725,current_date-120,current_date-90,'','Capitalised','DEMO-PL102-I2'),
('30000000-0000-4000-8000-000000000002',current_date-60,'interest',1433982,current_date-90,current_date-60,'','Capitalised','DEMO-PL102-I3'),
('30000000-0000-4000-8000-000000000002',current_date-30,'drawdown',60000000,null,null,'','Draw 3','DEMO-PL102-DD3'),
('30000000-0000-4000-8000-000000000002',current_date-30,'interest',1447541,current_date-60,current_date-30,'','Capitalised','DEMO-PL102-I4'),
-- PL-103: one interest charge paid, the next one and a late fee unpaid. Matured ten days ago.
('30000000-0000-4000-8000-000000000003',current_date-95,'drawdown',65000000,null,null,'Settlement statement','Settlement','DEMO-PL103-DD1'),
('30000000-0000-4000-8000-000000000003',current_date-65,'interest',667808,current_date-95,current_date-65,'','','DEMO-PL103-I1'),
('30000000-0000-4000-8000-000000000003',current_date-63,'payment',667808,null,null,'','Direct credit','DEMO-PL103-P1'),
('30000000-0000-4000-8000-000000000003',current_date-35,'interest',667808,current_date-65,current_date-35,'','','DEMO-PL103-I2'),
('30000000-0000-4000-8000-000000000003',current_date-12,'fee',25000,null,null,'','Late payment fee','DEMO-PL103-F1'),
-- PL-104: land loan, interest paid, valuation now old.
('30000000-0000-4000-8000-000000000004',current_date-420,'drawdown',90000000,null,null,'Settlement statement','Settlement','DEMO-PL104-DD1'),
('30000000-0000-4000-8000-000000000004',current_date-90,'interest',8543836,current_date-420,current_date-90,'','Opening months combined','DEMO-PL104-I1'),
('30000000-0000-4000-8000-000000000004',current_date-88,'payment',8543836,null,null,'','Direct credit','DEMO-PL104-P1'),
('30000000-0000-4000-8000-000000000004',current_date-60,'interest',776712,current_date-90,current_date-60,'','','DEMO-PL104-I2'),
('30000000-0000-4000-8000-000000000004',current_date-58,'payment',776712,null,null,'','Direct credit','DEMO-PL104-P2'),
('30000000-0000-4000-8000-000000000004',current_date-30,'interest',776712,current_date-60,current_date-30,'','','DEMO-PL104-I3'),
('30000000-0000-4000-8000-000000000004',current_date-27,'payment',776712,null,null,'','Direct credit','DEMO-PL104-P3'),
-- PL-106: repaid in full.
('30000000-0000-4000-8000-000000000006',current_date-500,'drawdown',50000000,null,null,'Settlement statement','Settlement','DEMO-PL106-DD1'),
('30000000-0000-4000-8000-000000000006',current_date-60,'interest',6027397,current_date-500,current_date-60,'','Life of loan','DEMO-PL106-I1'),
('30000000-0000-4000-8000-000000000006',current_date-60,'payment',56027397,null,null,'','Repaid on sale','DEMO-PL106-P1')
on conflict do nothing;

insert into allocations(id,code,loan_id,investor_id,amount_cents,investor_rate_bps,allocated_on) values
('50000000-0000-4000-8000-000000000001','AL-101A','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',70000000,800,current_date-200),
('50000000-0000-4000-8000-000000000002','AL-101B','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002',50000000,825,current_date-200),
('50000000-0000-4000-8000-000000000003','AL-102A','30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',100000000,900,current_date-150),
('50000000-0000-4000-8000-000000000004','AL-102B','30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003',80000000,900,current_date-90),
('50000000-0000-4000-8000-000000000005','AL-103A','30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000004',30000000,850,current_date-95),
('50000000-0000-4000-8000-000000000006','AL-103B','30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002',35000000,850,current_date-95),
('50000000-0000-4000-8000-000000000007','AL-104A','30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000003',90000000,825,current_date-420)
on conflict do nothing;

insert into conditions(id,code,loan_id,title,owner,due_on,met_on,evidence) values
('60000000-0000-4000-8000-000000000001','CON-101','30000000-0000-4000-8000-000000000001','Annual financial statements for the year','Mia',current_date-20,null,''),
('60000000-0000-4000-8000-000000000002','CON-102','30000000-0000-4000-8000-000000000002','Contract works insurance certificate','Jon',current_date-6,null,''),
('60000000-0000-4000-8000-000000000003','CON-103','30000000-0000-4000-8000-000000000005','Signed director guarantee','Mia',current_date+7,null,''),
('60000000-0000-4000-8000-000000000004','CON-104','30000000-0000-4000-8000-000000000002','Quantity surveyor report for draw 3','Jon',current_date-25,null,'')
on conflict do nothing;
commit;
