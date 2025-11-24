// routes/index.tsx
import { Head } from "$fresh/runtime.ts";
import { Handlers, PageProps } from "$fresh/server.ts";

import Nav from "../components/Nav.tsx";
import HeroFeature from "../islands/HeroFeature.tsx";
import ContextSwitcher from "../islands/ContextSwitcher.tsx";
import Footer from "../components/Footer.tsx";

interface HomeProps {
  ldClientId: string;
}

export const handler: Handlers<HomeProps> = {
  GET(req, ctx) {
    const ldClientId = Deno.env.get("LAUNCHDARKLY_CLIENT_ID") || "";
    return ctx.render({ ldClientId });
  },
};

export default function Home({ data }: PageProps<HomeProps>) {
  const { ldClientId } = data;
  return (
    <>
      <Head>
        <title>DATA_GATA | Modern Data Architecture</title>
        <meta name="description" content="DATA_GATA provides expert data architecture, analytics engineering, and lakehouse implementation services to help organizations build scalable, reliable data platforms." />
        <meta property="og:title" content="DATA_GATA | Modern Data Architecture" />
        <meta property="og:description" content="Expert data architecture, analytics engineering, and lakehouse implementation services." />
        <meta property="og:image" content="/gata_app_utils/nerdy_alligator_headshot.png" />
        <meta property="og:url" content="https://dasgata.com" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      
      <Nav />
      <main>
        <HeroFeature ldClientId={ldClientId} />
      </main>
      <ContextSwitcher ldClientId={ldClientId} />
      <Footer />
    </>
  );
}