import { LoginClient } from "./loginClient";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const next = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  return <LoginClient next={next || "/"} />;
}

