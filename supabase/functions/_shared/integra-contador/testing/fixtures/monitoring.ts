export type MonitoringFixtureEvent={clientId:string;updatedAt:string;changed:boolean;fingerprint:string};
export const MONITORING_FIXTURES={
 changed:{events:[{clientId:"client-1",updatedAt:"2026-08-14T12:00:00Z",changed:true,fingerprint:"event-1"}],quotaRemaining:999,waitMs:3000},
 unchanged:{events:[{clientId:"client-1",updatedAt:"2026-08-14T12:00:00Z",changed:false,fingerprint:"event-1"}],quotaRemaining:998,waitMs:3000},
 repeated:{events:[{clientId:"client-1",updatedAt:"2026-08-14T12:00:00Z",changed:true,fingerprint:"event-1"},{clientId:"client-1",updatedAt:"2026-08-14T12:00:00Z",changed:true,fingerprint:"event-1"}],quotaRemaining:997,waitMs:3000},
 quotaExhausted:{events:[],quotaRemaining:0,waitMs:86400000},
 delayed:{events:[],quotaRemaining:996,waitMs:20000},
 reconciliation:{events:[{clientId:"client-lost",updatedAt:"2026-08-13T12:00:00Z",changed:true,fingerprint:"lost-1"}],quotaRemaining:995,waitMs:3000},
} as const;
export type MonitoringFixtureScenario=keyof typeof MONITORING_FIXTURES;
