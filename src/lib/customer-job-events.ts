import { EventEmitter } from "node:events";
import type { GenerationJob, JobStatus } from "@/lib/types";
import type { WorkerOutputSlot } from "@/lib/worker";

export type CustomerJobEventType = "status" | "result";

export type CustomerJobEvent = {
  type: CustomerJobEventType;
  siteId: string;
  customerId: string;
  jobId: string;
  status: JobStatus;
  stage?: string;
  progress?: number;
  outputSlots?: WorkerOutputSlot[];
  error?: string;
  timing?: Record<string, string>;
  eventKind?: "progress" | "final";
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
  details: Partial<Pick<CustomerJobEvent, "stage" | "progress" | "outputSlots" | "error" | "timing" | "eventKind" | "alreadyFinal" | "alreadyProcessed">> = {}
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
