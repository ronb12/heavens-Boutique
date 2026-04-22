import { RegisterClient } from "./registerClient";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const next = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  return <RegisterClient next={next || "/"} />;
}

