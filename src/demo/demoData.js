export const demoData = {
  organization: {
    name: 'DEMO GROUP A.E.',
    afm: '999999999',
    stats: { partners: 12, compliant: 7, expiring: 5, expired: 2, missing: 3 },
    partners: [
      { name:'MedSupply A.E.', afm:'099999991', email:'quality@medsupply.demo', score:100, status:'compliant', certs:8, expiring:0, expired:0, missing:0, registered:true },
      { name:'CleanCare Services', afm:'099999992', email:'docs@cleancare.demo', score:83, status:'attention', certs:6, expiring:1, expired:0, missing:0, registered:true },
      { name:'BioLab Solutions', afm:'099999993', email:'compliance@biolab.demo', score:67, status:'attention', certs:5, expiring:1, expired:0, missing:1, registered:true },
      { name:'TechMed Systems', afm:'099999994', email:'certs@techmed.demo', score:92, status:'compliant', certs:7, expiring:1, expired:0, missing:0, registered:true },
      { name:'SafeWaste ΕΠΕ', afm:'099999995', email:'quality@safewaste.demo', score:58, status:'critical', certs:4, expiring:0, expired:1, missing:2, registered:true },
      { name:'PharmaLogistics A.E.', afm:'099999996', email:'qa@pharmalog.demo', score:88, status:'attention', certs:6, expiring:1, expired:0, missing:0, registered:true },
      { name:'SterilePro Μ.ΙΚΕ', afm:'099999997', email:'info@sterilepro.demo', score:100, status:'compliant', certs:5, expiring:0, expired:0, missing:0, registered:true },
      { name:'GreenFacility A.E.', afm:'099999998', email:'iso@greenfacility.demo', score:74, status:'critical', certs:4, expiring:0, expired:1, missing:1, registered:true },
      { name:'Medical Gas Systems', afm:'099999981', email:'certificates@medgas.demo', score:95, status:'compliant', certs:7, expiring:0, expired:0, missing:0, registered:true },
      { name:'Clinical Devices IKE', afm:'099999982', email:'regulatory@clinicaldevices.demo', score:90, status:'compliant', certs:9, expiring:1, expired:0, missing:0, registered:true },
      { name:'Hospital Linen Group', afm:'099999983', email:'office@linen.demo', score:100, status:'compliant', certs:4, expiring:0, expired:0, missing:0, registered:false },
      { name:'CareFood Catering', afm:'099999984', email:'haccp@carefood.demo', score:96, status:'compliant', certs:5, expiring:0, expired:0, missing:0, registered:false }
    ],
    certificates: [
      { title:'ISO 9001:2015', type:'ISO 9001', owner:'DEMO GROUP A.E.', issued:'2024-06-20', expires:'2027-06-19', status:'active', is_private:false, file_url:'/assets/demo-certificates/company-demo.pdf', certificate_number:'CT-DEMO', issuer:'Demo Certification Body', notes:'Demo certificate' },
      { title:'ISO 14001:2015', type:'ISO 14001', owner:'DEMO GROUP A.E.', issued:'2024-11-01', expires:'2027-10-31', status:'active', is_private:false, file_url:'/assets/demo-certificates/company-demo.pdf', certificate_number:'CT-DEMO', issuer:'Demo Certification Body', notes:'Demo certificate' },
      { title:'ISO 27001:2022', type:'ISO 27001', owner:'DEMO GROUP A.E.', issued:'2023-09-04', expires:'2026-09-03', status:'soon', is_private:false, file_url:'/assets/demo-certificates/company-demo.pdf', certificate_number:'CT-DEMO', issuer:'Demo Certification Body', notes:'Demo certificate' },
      { title:'ISO 45001:2018', type:'ISO 45001', owner:'DEMO GROUP A.E.', issued:'2025-01-12', expires:'2028-01-11', status:'active', is_private:false, file_url:'/assets/demo-certificates/company-demo.pdf', certificate_number:'CT-DEMO', issuer:'Demo Certification Body', notes:'Demo certificate' },
      { title:'Ασφαλιστική ενημερότητα', type:'Ασφαλιστική ενημερότητα', owner:'DEMO GROUP A.E.', issued:'2026-02-28', expires:'2026-08-27', status:'soon', is_private:false, file_url:'/assets/demo-certificates/company-demo.pdf', certificate_number:'CT-DEMO', issuer:'Demo Certification Body', notes:'Demo certificate' },
      { title:'Φορολογική ενημερότητα', type:'Φορολογική ενημερότητα', owner:'DEMO GROUP A.E.', issued:'2026-07-15', expires:'2026-09-14', status:'soon', is_private:false, file_url:'/assets/demo-certificates/company-demo.pdf', certificate_number:'CT-DEMO', issuer:'Demo Certification Body', notes:'Demo certificate' },
      { title:'Άδεια λειτουργίας', type:'Operating License', owner:'DEMO GROUP A.E.', issued:'2023-01-16', expires:'2028-01-15', status:'active', is_private:false, file_url:'/assets/demo-certificates/company-demo.pdf', certificate_number:'CT-DEMO', issuer:'Demo Certification Body', notes:'Demo certificate' },
      { title:'Πιστοποιητικό πυρασφάλειας', type:'Fire Safety', owner:'DEMO GROUP A.E.', issued:'2025-02-10', expires:'2027-02-09', status:'active', is_private:false, file_url:'/assets/demo-certificates/company-demo.pdf', certificate_number:'CT-FIRE-DEMO', issuer:'Demo Certification Body', notes:'Demo certificate' }
    ],
    activity: [
      { text:'Η MedSupply A.E. ανανέωσε το ISO 13485', time:'Πριν 18 λεπτά', kind:'success' },
      { text:'Το ISO 27001 της εταιρείας λήγει στις 03/09/2026', time:'Πριν 1 ώρα', kind:'warning' },
      { text:'Η BioLab Solutions έχει 1 ελλιπές δικαιολογητικό', time:'Σήμερα', kind:'danger' },
      { text:'Η Clinical Devices IKE ανέβασε νέο CE', time:'Σήμερα', kind:'info' },
      { text:'Η GreenFacility A.E. έχει ληγμένο πιστοποιητικό', time:'Χθες', kind:'danger' },
      { text:'Προστέθηκε ο CareFood Catering', time:'2 ημέρες πριν', kind:'info' }
    ]
  },
  admin: {
    stats:{ organizations:34, partners:126, users:181, expiring:22 },
    organizations:[
      { name:'DEMO GROUP A.E.', type:'Οργανισμός', status:'active', users:4 },
      { name:'MedSupply A.E.', type:'Οργανισμός', status:'active', users:2 },
      { name:'CleanCare Services', type:'Οργανισμός', status:'active', users:1 },
      { name:'BioLab Solutions', type:'Οργανισμός', status:'pending', users:1 },
      { name:'Hospital Demo Group', type:'Οργανισμός', status:'blocked', users:3 }
    ]
  }
};
