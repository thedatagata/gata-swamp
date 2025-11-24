import { Handlers, PageProps } from "$fresh/server.ts";
import { getCookies } from "$std/http/cookie.ts";
import DemoSetup from "../../islands/demo/DemoSetup.tsx";

interface DemoSetupData {
  demoEmail: string;
}

export const handler: Handlers<DemoSetupData> = {
  GET(req, ctx) {
    const cookies = getCookies(req.headers);
    const demoEmail = cookies.demo_access_token;

    if (!demoEmail) {
      // Not authenticated as demo user -> redirect to landing page
      return new Response("", {
        status: 303,
        headers: { Location: "/" },
      });
    }

    return ctx.render({ demoEmail });
  },
};

export default function DemoSetupPage({ data }: PageProps<DemoSetupData>) {
  return <DemoSetup demoEmail={data.demoEmail} />;
}
