import { getAccount, exportAccount } from "@/lib/server/accounts";
import { currentUid, parentAreaUnlocked } from "@/lib/server/session";

/** Download of all the account's data. Parent area only. */
export async function GET() {
  const uid = await currentUid();
  if (!uid || !(await getAccount(uid)) || !(await parentAreaUnlocked(uid))) {
    return new Response("Open the parent area first.", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const data = await exportAccount(uid);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="zukka-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
