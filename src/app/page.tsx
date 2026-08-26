import { redirect } from "next/navigation";
import {
  getKindeServerSession,
  LoginLink,
  RegisterLink,
} from "@kinde-oss/kinde-auth-nextjs/server";
import { Logo } from "@/components/Logo";

export default async function Home() {
  const { isAuthenticated } = getKindeServerSession();
  const authed = await isAuthenticated();

  if (authed) {
    redirect("/upload");
  }

  return (
    <div
      className="flex flex-1 items-center justify-center bg-neutral-950 bg-cover bg-center bg-no-repeat px-6 py-16"
      style={{ backgroundImage: "url(/kinde-background.png)" }}
    >
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <p className="flex items-center justify-center gap-2 font-mono text-sm font-semibold tracking-tight">
          <Logo className="h-6 w-6" />
          snow-audit
        </p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">
          Sign in to run an audit
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Upload an Update Set export and get a plain-English summary and a
          security/quality review of it.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <LoginLink className="rounded-lg bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
            Sign in
          </LoginLink>
          <RegisterLink className="rounded-lg border border-neutral-300 px-5 py-3 text-sm font-semibold hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900">
            Sign up
          </RegisterLink>
        </div>
      </div>
    </div>
  );
}
