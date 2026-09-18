export type ProtectedClass =
  | "auth"
  | "security"
  | "billing"
  | "database"
  | "migration"
  | "permission"
  | "network"
  | "deployment"
  | "secrets";

const rules: Array<[ProtectedClass, RegExp]> = [
  ["secrets", /(^|\/)(\.env(?:\..*)?|.*(?:secret|credential|password|token|private.?key).*|id_rsa(?:\..*)?)$/i],
  ["auth", /(^|\/)(auth|authentication|oauth|session|login|password-reset)(\/|$)/i],
  ["security", /(^|\/)(security|threat|csrf|rate.?limit|crypto)(\/|$)/i],
  ["billing", /(^|\/)(billing|payment|payments|invoice|pricing|payout)(\/|$)/i],
  ["database", /(^|\/)(db|database|repositories|orm|schema)(\/|$)/i],
  ["migration", /(^|\/)(migrations?|seeders?)(\/|$)|\.(sql|prisma)$/i],
  ["permission", /(^|\/)(permission|permissions|rbac|roles?|access.?control)(\/|$)/i],
  ["network", /(^|\/)(network|proxy|firewall|dns|ingress|egress)(\/|$)/i],
  [
    "deployment",
    /(^|\/)(deploy|deployment|infra|terraform|k8s|kubernetes|helm)(\/|$)|(^|\/)(Dockerfile|docker-compose[^/]*)$/i,
  ],
];

export function validateGitPath(path: string): void {
  if (!path || path.includes("\0") || path.includes("\\") || path.startsWith("/") || /^[A-Za-z]:/.test(path)) {
    throw new Error(`Unsafe Git path: ${path}`);
  }
  const segments = path.split("/");
  if (segments.some((segment) => segment === ".." || (segment === "" && segments.length > 1))) {
    throw new Error(`Unsafe Git path: ${path}`);
  }
}

export function protectedClassesForPath(path: string): ProtectedClass[] {
  validateGitPath(path);
  return rules.filter(([, pattern]) => pattern.test(path)).map(([classification]) => classification);
}
