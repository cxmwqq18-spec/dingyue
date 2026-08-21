import "server-only";

export function shouldFallbackRelationalRead(error: unknown): boolean {
  void error;
  return false;
}

export function shouldUseRelationalReadFallbackCircuit(): boolean {
  return false;
}

export function warnRelationalFallback(scope: string, error: unknown): void {
  void scope;
  void error;
}
