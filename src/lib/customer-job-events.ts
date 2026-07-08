import { EventEmitter } from "node:events";
import type { GenerationJob, JobStatus } from "@/lib/types";

export type CustomerJobEventType = "status" | "result";

export type CustomerJobEvent = {
  type: CustomerJobEventType;
  siteId: string;
  customerId: string;
  jobId: string;
  status: JobStatus;
  stage?: string;
  updatedAt: string;
  emittedAt: string;
  alreadyFinal?: boolean;
  alreadyProcessed?: boolean;
};

const customerJobEventName = "customer-job-event";
const globalCustomerJobEvents = globalThis as typeof globalThis & {
  __dreamshootCustomerJobEvents?: EventEmitter;
};
const customerJobEvents = globalCustomerJobEvents.__dreamshootCustomerJobEvents ?? new EventEmitter();
globalCustomerJobEvents.__dreamshootCustomerJobEvents = customerJobEvents;
customerJobEvents.setMaxListeners(Number(process.env.CUSTOMER_JOB_EVENT_MAX_LISTENERS ?? "1000"));

export function publishCustomerJobEvent(event: Omit<CustomerJobEvent, "emittedAt">): void {
  customerJobEvents.emit(customerJobEventName, {
    ...event,
    emittedAt: new Date().toISOString()
  } satisfies CustomerJobEvent);
}

export function publishCustomerJobEventForJob(
  type: CustomerJobEventType,
  job: Pick<GenerationJob, "id" | "siteId" | "customerId" | "status" | "updatedAt">,
  details: Partial<Pick<CustomerJobEvent, "stage" | "alreadyFinal" | "alreadyProcessed">> = {}
): void {
  publishCustomerJobEvent({
    type,
    siteId: job.siteId,
    customerId: job.customerId,
    jobId: job.id,
    status: job.status,
    updatedAt: job.updatedAt,
    ...details
  });
}

export function subscribeCustomerJobEvents(
  filter: Pick<CustomerJobEvent, "siteId" | "customerId">,
  listener: (event: CustomerJobEvent) => void
): () => void {
  const scopedListener = (event: CustomerJobEvent) => {
    if (event.siteId !== filter.siteId || event.customerId !== filter.customerId) return;
    listener(event);
  };
  customerJobEvents.on(customerJobEventName, scopedListener);
  return () => customerJobEvents.off(customerJobEventName, scopedListener);
}
