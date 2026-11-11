/* Generated from frontend/src/data/seed.ts (SEED_REQS). IDs are fixed so re-seeding recognises
   rows it already inserted. Timestamps without a zone are India time, as in the prototype.
   Seeded purchases were entered by functional heads, so they are verified. */

export const SEED_REQUISITIONS = [
  {
    "id": "4482fc17-49e9-58e9-b8b4-b39f99f19826",
    "ref": "REQ-2026-0027",
    "dealershipId": "D_JCB_NSK",
    "facilityId": "F01",
    "deptId": "DEP_IT",
    "item": "Service advisor tablet + 24-port network switch",
    "qty": 2,
    "estCost": 65000,
    "justification": "Bay-side job card entry; existing switch at capacity.",
    "raisedBy": "U_NIL",
    "raisedAt": "2026-08-03T10:20:00",
    "advance": {
      "required": true,
      "amount": 20000,
      "terms": "30% advance against PO, balance on delivery"
    },
    "expectedDelivery": "2026-08-14",
    "approvals": [
      {
        "stage": "bh",
        "decision": "approved",
        "by": "U_SAM",
        "at": "2026-08-04T09:10:00",
        "note": "",
        "onBehalfOf": null,
        "lateDays": null
      },
      {
        "stage": "fn",
        "decision": "approved",
        "by": "U_SUNIL",
        "at": "2026-08-05T16:40:00",
        "note": "Standardise on CBS250.",
        "onBehalfOf": null,
        "lateDays": null
      },
      {
        "stage": "directorPurchase",
        "decision": "approved",
        "by": "U_ARJ",
        "at": "2026-08-05T18:00:00",
        "note": "",
        "onBehalfOf": null,
        "lateDays": null
      },
      {
        "stage": "advanceApproval",
        "decision": "approved",
        "by": "U_DEE",
        "at": "2026-08-06T09:30:00",
        "note": "",
        "onBehalfOf": null,
        "lateDays": null
      },
      {
        "stage": "financeApproval",
        "decision": "approved",
        "by": "U_SUJAY",
        "at": "2026-08-13T16:20:00",
        "note": "Invoice matched to approved requisition.",
        "onBehalfOf": null,
        "lateDays": null
      },
      {
        "stage": "directorApproval",
        "decision": "approved",
        "by": "U_ARJ",
        "at": "2026-08-13T18:40:00",
        "note": "",
        "onBehalfOf": null,
        "lateDays": null
      }
    ],
    "payments": [
      {
        "kind": "advance",
        "by": "U_POO",
        "at": "2026-08-06T12:15:00",
        "amount": 20000,
        "mode": "NEFT",
        "ref": "UTR-4471902"
      },
      {
        "kind": "balance",
        "by": "U_POO",
        "at": "2026-08-14T10:00:00",
        "amount": 43900,
        "mode": "NEFT",
        "ref": "UTR-4482310"
      }
    ],
    "procurement": {
      "by": "U_SUNIL",
      "at": "2026-08-12T11:00:00",
      "actualCost": 63900,
      "vendor": "Ingram Micro / Samsung",
      "invoice": "INV-8841"
    }
  },
  {
    "id": "f9bac549-3b75-5d2c-a2a7-82131b186b56",
    "ref": "REQ-2026-0029",
    "dealershipId": "D_MTB",
    "facilityId": "F12",
    "deptId": "DEP_ADM",
    "item": "Water purifier for customer lounge",
    "qty": 1,
    "estCost": 40000,
    "justification": "Existing unit beyond repair; high footfall lounge.",
    "raisedBy": "U_KIR",
    "raisedAt": "2026-08-14T12:05:00",
    "advance": {
      "required": false,
      "amount": 0,
      "terms": ""
    },
    "expectedDelivery": null,
    "approvals": [
      {
        "stage": "bh",
        "decision": "approved",
        "by": "U_VIJ",
        "at": "2026-08-15T10:00:00",
        "note": "",
        "onBehalfOf": null,
        "lateDays": null
      },
      {
        "stage": "fn",
        "decision": "approved",
        "by": "U_PARESH",
        "at": "2026-08-16T14:20:00",
        "note": "",
        "onBehalfOf": null,
        "lateDays": null
      },
      {
        "stage": "financeApproval",
        "decision": "approved",
        "by": "U_SUJAY",
        "at": "2026-08-25T14:00:00",
        "note": "",
        "onBehalfOf": null,
        "lateDays": null
      },
      {
        "stage": "directorApproval",
        "decision": "approved",
        "by": "U_ARJ",
        "at": "2026-08-25T17:10:00",
        "note": "",
        "onBehalfOf": null,
        "lateDays": null
      }
    ],
    "payments": [
      {
        "kind": "balance",
        "by": "U_SAR",
        "at": "2026-08-26T11:40:00",
        "amount": 34800,
        "mode": "Cheque",
        "ref": "CHQ-220118"
      }
    ],
    "procurement": {
      "by": "U_PARESH",
      "at": "2026-08-24T10:30:00",
      "actualCost": 34800,
      "vendor": "Eureka Forbes",
      "invoice": "INV-9012"
    }
  },
  {
    "id": "475119cd-2176-5991-a132-37db6cf93019",
    "ref": "REQ-2026-0021",
    "dealershipId": "D_CORP",
    "facilityId": "F14",
    "deptId": "DEP_IT",
    "item": "Conference room display 55\"",
    "qty": 1,
    "estCost": 75000,
    "justification": "Board room review meetings.",
    "raisedBy": "U_SUNIL",
    "raisedAt": "2026-07-09T09:00:00",
    "advance": {
      "required": false,
      "amount": 0,
      "terms": ""
    },
    "expectedDelivery": null,
    "approvals": [
      {
        "stage": "bh",
        "decision": "approved",
        "by": "U_ARJ",
        "at": "2026-07-10T11:00:00",
        "note": "Corporate — Director approval.",
        "onBehalfOf": null,
        "lateDays": null
      },
      {
        "stage": "fn",
        "decision": "approved",
        "by": "U_SUNIL",
        "at": "2026-07-10T11:05:00",
        "note": "",
        "onBehalfOf": null,
        "lateDays": null
      },
      {
        "stage": "financeApproval",
        "decision": "approved",
        "by": "U_SUJAY",
        "at": "2026-07-19T11:00:00",
        "note": "",
        "onBehalfOf": null,
        "lateDays": null
      },
      {
        "stage": "directorApproval",
        "decision": "approved",
        "by": "U_ARJ",
        "at": "2026-07-19T16:00:00",
        "note": "",
        "onBehalfOf": null,
        "lateDays": null
      }
    ],
    "payments": [
      {
        "kind": "balance",
        "by": "U_SUJAY",
        "at": "2026-07-20T09:30:00",
        "amount": 68000,
        "mode": "NEFT",
        "ref": "UTR-4390221"
      }
    ],
    "procurement": {
      "by": "U_SUNIL",
      "at": "2026-07-18T15:00:00",
      "actualCost": 68000,
      "vendor": "LG Electronics",
      "invoice": "INV-7725"
    }
  },
  {
    "id": "5d554608-598d-5ece-8501-f4c2a73863e2",
    "ref": "REQ-2026-0033",
    "dealershipId": "D_MAH_CHK",
    "facilityId": "F08",
    "deptId": "DEP_HR",
    "item": "Biometric attendance terminals",
    "qty": 3,
    "estCost": 54000,
    "justification": "Jalna outlet has no attendance capture.",
    "raisedBy": "U_ANI",
    "raisedAt": "2026-09-01T11:30:00",
    "advance": {
      "required": true,
      "amount": 27000,
      "terms": "50% advance with order — vendor does not ship otherwise"
    },
    "expectedDelivery": "2026-09-25",
    "approvals": [
      {
        "stage": "bh",
        "decision": "approved",
        "by": "U_RAJ",
        "at": "2026-09-02T09:45:00",
        "note": "",
        "onBehalfOf": null,
        "lateDays": null
      }
    ],
    "payments": [],
    "procurement": null
  },
  {
    "id": "3b8e35dc-61f5-5a01-8696-55de22d1d06c",
    "ref": "REQ-2026-0034",
    "dealershipId": "D_JCB_NSK",
    "facilityId": "F03",
    "deptId": "DEP_IT",
    "item": "Desktop PCs for Jalgaon back office",
    "qty": 2,
    "estCost": 96000,
    "justification": "Two new back-office hires from October.",
    "raisedBy": "U_NIL",
    "raisedAt": "2026-09-03T15:10:00",
    "advance": {
      "required": true,
      "amount": 30000,
      "terms": "Advance against proforma invoice"
    },
    "expectedDelivery": "2026-10-05",
    "approvals": [],
    "payments": [],
    "procurement": null
  },
  {
    "id": "ba5b6970-efbb-53a7-8681-118f94e5ea4c",
    "ref": "REQ-2026-0030",
    "dealershipId": "D_MTB",
    "facilityId": "F13",
    "deptId": "DEP_ADM",
    "item": "Executive office furniture set",
    "qty": 1,
    "estCost": 185000,
    "justification": "Nanded outlet manager cabin refurbishment.",
    "raisedBy": "U_KIR",
    "raisedAt": "2026-08-18T10:00:00",
    "advance": {
      "required": true,
      "amount": 55000,
      "terms": "30% advance"
    },
    "expectedDelivery": null,
    "approvals": [
      {
        "stage": "bh",
        "decision": "approved",
        "by": "U_VIJ",
        "at": "2026-08-19T09:00:00",
        "note": "",
        "onBehalfOf": null,
        "lateDays": null
      },
      {
        "stage": "fn",
        "decision": "rejected",
        "by": "U_PARESH",
        "at": "2026-08-20T17:30:00",
        "note": "Defer to next FY — refurbishment not budgeted this quarter.",
        "onBehalfOf": null,
        "lateDays": null
      }
    ],
    "payments": [],
    "procurement": null
  },
  {
    "id": "03aaf21e-6877-59fe-a3bb-257abd97d531",
    "ref": "REQ-2026-0026",
    "dealershipId": "D_HMSI",
    "facilityId": "F10",
    "deptId": "DEP_IT",
    "item": "Showroom digital signage screens",
    "qty": 4,
    "estCost": 240000,
    "justification": "Replace printed offer boards.",
    "raisedBy": "U_NIL",
    "raisedAt": "2026-07-28T14:00:00",
    "advance": {
      "required": false,
      "amount": 0,
      "terms": ""
    },
    "expectedDelivery": null,
    "approvals": [
      {
        "stage": "bh",
        "decision": "rejected",
        "by": "U_VIS",
        "at": "2026-07-29T12:00:00",
        "note": "Revisit after festive season; use existing boards for now.",
        "onBehalfOf": null,
        "lateDays": null
      }
    ],
    "payments": [],
    "procurement": null
  },
  {
    "id": "dd744fcf-cf78-5008-8e53-9a212f950b4c",
    "ref": "REQ-2026-0019",
    "dealershipId": "D_MTB",
    "facilityId": "F13",
    "deptId": "DEP_IT",
    "item": "Nanded outlet CCTV upgrade",
    "qty": 1,
    "estCost": 46000,
    "justification": "Existing cameras failing; night coverage lost.",
    "raisedBy": "U_KIR",
    "raisedAt": "2026-06-10T09:00:00",
    "advance": {
      "required": false,
      "amount": 0,
      "terms": ""
    },
    "expectedDelivery": "2026-07-05",
    "approvals": [
      {
        "stage": "bh",
        "decision": "approved",
        "by": "U_VIJ",
        "at": "2026-06-11T10:00:00",
        "note": "",
        "onBehalfOf": null,
        "lateDays": null
      },
      {
        "stage": "fn",
        "decision": "approved",
        "by": "U_ARJ",
        "at": "2026-06-18T17:00:00",
        "note": "Approved in place of IT Head — no response for 6 days.",
        "onBehalfOf": "U_SUNIL",
        "lateDays": 6
      }
    ],
    "payments": [],
    "procurement": null
  },
  {
    "id": "8326cba4-8dd9-5de9-a7bd-4cb7cb0d3236",
    "ref": "REQ-2026-0024",
    "dealershipId": "D_MAH_CHK",
    "facilityId": "F09",
    "deptId": "DEP_ADM",
    "item": "Jalna outlet UPS & battery bank",
    "qty": 1,
    "estCost": 88000,
    "justification": "Frequent outages disrupting billing at Jalna.",
    "raisedBy": "U_ANI",
    "raisedAt": "2026-07-02T10:00:00",
    "advance": {
      "required": true,
      "amount": 35000,
      "terms": "40% advance"
    },
    "expectedDelivery": "2026-08-10",
    "approvals": [
      {
        "stage": "bh",
        "decision": "approved",
        "by": "U_RAJ",
        "at": "2026-07-03T09:00:00",
        "note": "",
        "onBehalfOf": null,
        "lateDays": null
      },
      {
        "stage": "fn",
        "decision": "approved",
        "by": "U_PARESH",
        "at": "2026-07-04T11:00:00",
        "note": "",
        "onBehalfOf": null,
        "lateDays": null
      },
      {
        "stage": "directorPurchase",
        "decision": "approved",
        "by": "U_ARJ",
        "at": "2026-07-05T10:00:00",
        "note": "",
        "onBehalfOf": null,
        "lateDays": null
      },
      {
        "stage": "advanceApproval",
        "decision": "approved",
        "by": "U_SWA",
        "at": "2026-07-06T10:00:00",
        "note": "",
        "onBehalfOf": null,
        "lateDays": null
      }
    ],
    "payments": [
      {
        "kind": "advance",
        "by": "U_NIT",
        "at": "2026-07-07T12:00:00",
        "amount": 35000,
        "mode": "NEFT",
        "ref": "UTR-4301188"
      }
    ],
    "procurement": null
  },
  {
    "id": "721e1852-4794-5301-a65f-36152bdbab72",
    "ref": "REQ-2026-0036",
    "dealershipId": "D_JCB_NSK",
    "facilityId": "F02",
    "deptId": "DEP_ADM",
    "item": "Dhule outlet signage & branding",
    "qty": 1,
    "estCost": 145000,
    "justification": "Outlet rebranding to current JCB identity guidelines.",
    "raisedBy": "U_NIL",
    "raisedAt": "2026-08-29T09:40:00",
    "advance": {
      "required": true,
      "amount": 58000,
      "terms": "40% advance before fabrication starts"
    },
    "expectedDelivery": "2026-09-20",
    "approvals": [
      {
        "stage": "bh",
        "decision": "approved",
        "by": "U_SAM",
        "at": "2026-08-30T10:15:00",
        "note": "",
        "onBehalfOf": null,
        "lateDays": null
      },
      {
        "stage": "fn",
        "decision": "approved",
        "by": "U_PARESH",
        "at": "2026-08-31T15:00:00",
        "note": "Use empanelled fabricator.",
        "onBehalfOf": null,
        "lateDays": null
      },
      {
        "stage": "directorPurchase",
        "decision": "approved",
        "by": "U_ARJ",
        "at": "2026-08-31T18:30:00",
        "note": "Rebranding is overdue at Dhule.",
        "onBehalfOf": null,
        "lateDays": null
      },
      {
        "stage": "advanceApproval",
        "decision": "approved",
        "by": "U_DEE",
        "at": "2026-09-01T10:00:00",
        "note": "Vendor bank details verified.",
        "onBehalfOf": null,
        "lateDays": null
      }
    ],
    "payments": [],
    "procurement": null
  }
] as const;
