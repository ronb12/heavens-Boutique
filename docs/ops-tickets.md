# Operations tickets

| ID | Status | Item | Notes |
|----|--------|------|--------|
| OPS-1 | **Open** | **Resolve GitHub account issue** | **Remote `git push` returns HTTP 403 with message: “Your account is suspended.” This blocks pushing `main` and running the GitHub Actions → Vercel deploy pipeline.** See **Context (for you / support)** below. Next step: open [GitHub support](https://support.github.com) and follow their process to unsuspend, appeal, or get an explanation. After it is fixed, run `git push origin main` from the repo to trigger deploy. |

### Context (for you / support) — why this is confusing

- You run a **business that builds websites and apps** for clients; you use GitHub in a normal, professional way for development and deployment.
- A suspension with little or no prior warning **doesn’t line up** with how you use the account, so you need **clarity** from GitHub: what policy was triggered, whether it was a mistake, and what to do next.
- When you contact support, you can say you’re a **legitimate business** using GitHub for product/client work, that the suspension is **unexpected**, and you want to **understand the reason** and **restore access** (or move forward if the account can’t be recovered).

### Can someone else (e.g. automation) “find out why” for you?

**No.** The exact reason is **not public** and **not guessable** from a `git push` error, this repo, or a developer’s tools. Only these can tell you *your* case:

1. **Email from GitHub** to the address on the account (search inbox/spam for “GitHub” and “suspended” / “account”).
2. **The message when you try to sign in** at [github.com/login](https://github.com/login) (sometimes it points to a policy or next step).
3. **GitHub Support** or the official [Appeal and reinstatement](https://docs.github.com/en/site-policy/acceptable-use-policies/github-appeal-and-reinstatement) process (includes a form linked from that page).

**Common** reasons people *in general* report (not your specific one): automated/spam or abuse flags, **suspicious logins** or **compromised** token/password, **billing** on paid plans, **DMCA** or other legal notices, **malware** reports on repos, **excessive** bandwidth or storage on free features, or **Terms / Acceptable Use** content issues. Yours may be none of these—**you need GitHub’s own message or staff reply** to know.

When OPS-1 is done, change status to **Done** and add the resolution date in Notes.
