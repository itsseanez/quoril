// prisma/seeds/companies.ts
//
// Known tech companies and their ATS identifiers.
//
// Slugs are verified against their public job board URLs:
//   Greenhouse:  https://boards.greenhouse.io/v1/boards/{slug}/jobs
//   Lever:       https://api.lever.co/v0/postings/{site}
//   Ashby:       https://api.ashbyhq.com/posting-api/job-board/{boardId}
//
// To verify a slug before adding:
//   curl https://boards.greenhouse.io/v1/boards/{slug}/jobs | head -c 200
//   curl https://api.lever.co/v0/postings/{site} | head -c 200
//   curl https://api.ashbyhq.com/posting-api/job-board/{boardId} | head -c 200
//
// To add a new company: add an entry below and re-run `npx prisma db seed`.
// A company can have multiple ATS identifiers if they use more than one board.

import { PrismaClient } from "@prisma/client";

interface CompanySeed {
  name: string;
  website?: string;
  greenhouseSlug?: string;
  leverSite?: string;
  ashbyBoardId?: string;
  workdayTenant?: string;
  workdayInstance?: string;
  workdaySiteName?: string;
}

const companies: CompanySeed[] = [
  // ── Greenhouse ─────────────────────────────────────────────────────────────
  // Verified slugs: boards.greenhouse.io/v1/boards/{slug}/jobs

  // Fintech & Payments
  { name: "Stripe",           website: "https://stripe.com",           greenhouseSlug: "stripe" },
  { name: "Plaid",            website: "https://plaid.com",            greenhouseSlug: "plaid" },
  { name: "Brex",             website: "https://brex.com",             greenhouseSlug: "brex" },
  { name: "Chime",            website: "https://chime.com",            greenhouseSlug: "chime" },
  { name: "Affirm",           website: "https://affirm.com",           greenhouseSlug: "affirm" },
  { name: "Robinhood",        website: "https://robinhood.com",        greenhouseSlug: "robinhood" },
  { name: "Marqeta",          website: "https://marqeta.com",          greenhouseSlug: "marqeta" },

  // Infrastructure & Dev Tools
  { name: "Vercel",           website: "https://vercel.com",           greenhouseSlug: "vercel" },
  { name: "Cloudflare",       website: "https://cloudflare.com",       greenhouseSlug: "cloudflare" },
  { name: "MongoDB",          website: "https://mongodb.com",          greenhouseSlug: "mongodb" },
  { name: "Datadog",          website: "https://datadog.com",          greenhouseSlug: "datadog" },
  { name: "PagerDuty",        website: "https://pagerduty.com",        greenhouseSlug: "pagerduty" },
  { name: "Mapbox",           website: "https://mapbox.com",           greenhouseSlug: "mapbox" },
  { name: "Cockroach Labs",   website: "https://cockroachlabs.com",    greenhouseSlug: "cockroachlabs" },
  { name: "Temporal",         website: "https://temporal.io",          greenhouseSlug: "temporal" },
  { name: "Sentry",           website: "https://sentry.io",            greenhouseSlug: "sentry" },

  // Productivity & Collaboration
  { name: "Notion",           website: "https://notion.so",            greenhouseSlug: "notion" },
  { name: "Figma",            website: "https://figma.com",            greenhouseSlug: "figma" },
  { name: "Miro",             website: "https://miro.com",             greenhouseSlug: "miro" },
  { name: "Loom",             website: "https://loom.com",             greenhouseSlug: "loom" },
  { name: "Asana",            website: "https://asana.com",            greenhouseSlug: "asana" },
  { name: "Zapier",           website: "https://zapier.com",           greenhouseSlug: "zapier" },
  { name: "Airtable",         website: "https://airtable.com",         greenhouseSlug: "airtable" },

  // Sales & Marketing
  { name: "HubSpot",          website: "https://hubspot.com",          greenhouseSlug: "hubspot" },
  { name: "Braze",            website: "https://braze.com",            greenhouseSlug: "braze" },
  { name: "Gong",             website: "https://gong.io",              greenhouseSlug: "gong" },
  { name: "Klaviyo",          website: "https://klaviyo.com",          greenhouseSlug: "klaviyo" },
  { name: "Amplitude",        website: "https://amplitude.com",        greenhouseSlug: "amplitude" },
  { name: "Mixpanel",         website: "https://mixpanel.com",         greenhouseSlug: "mixpanel" },
  { name: "Segment",          website: "https://segment.com",          greenhouseSlug: "segment" },

  // AI & ML
  { name: "Anthropic",        website: "https://anthropic.com",        greenhouseSlug: "anthropic" },
  { name: "Hugging Face",     website: "https://huggingface.co",       greenhouseSlug: "huggingface" },
  { name: "Scale AI",         website: "https://scale.com",            greenhouseSlug: "scaleai" },
  { name: "Cohere",           website: "https://cohere.com",           greenhouseSlug: "cohere" },
  { name: "Weights & Biases", website: "https://wandb.ai",             greenhouseSlug: "wandb" },
  { name: "Mistral AI",       website: "https://mistral.ai",           greenhouseSlug: "mistral" },

  // Security
  { name: "Crowdstrike",      website: "https://crowdstrike.com",      greenhouseSlug: "crowdstrike" },
  { name: "Snyk",             website: "https://snyk.io",              greenhouseSlug: "snyk" },
  { name: "Lacework",         website: "https://lacework.com",         greenhouseSlug: "lacework" },

  // E-commerce & Marketplace
  { name: "Faire",            website: "https://faire.com",            greenhouseSlug: "faire" },
  { name: "Whatnot",          website: "https://whatnot.com",          greenhouseSlug: "whatnot" },
  { name: "Poshmark",         website: "https://poshmark.com",         greenhouseSlug: "poshmark" },

  // Healthcare & Biotech
  { name: "Tempus",           website: "https://tempus.com",           greenhouseSlug: "tempus" },
  { name: "Ro",               website: "https://ro.co",                greenhouseSlug: "ro" },
  { name: "Hims & Hers",      website: "https://forhims.com",          greenhouseSlug: "forhims" },
  { name: "Flatiron Health",  website: "https://flatiron.com",         greenhouseSlug: "flatiron" },

  // Other well-known tech
  { name: "Discord",          website: "https://discord.com",          greenhouseSlug: "discord" },
  { name: "Duolingo",         website: "https://duolingo.com",         greenhouseSlug: "duolingo" },
  { name: "Grammarly",        website: "https://grammarly.com",        greenhouseSlug: "grammarly" },
  { name: "Twilio",           website: "https://twilio.com",           greenhouseSlug: "twilio" },
  { name: "SendGrid",         website: "https://sendgrid.com",         greenhouseSlug: "sendgrid" },
  { name: "Gusto",            website: "https://gusto.com",            greenhouseSlug: "gusto" },
  { name: "Rippling",         website: "https://rippling.com",         greenhouseSlug: "rippling" },
  { name: "Lattice",          website: "https://lattice.com",          greenhouseSlug: "lattice" },
  { name: "Intercom",         website: "https://intercom.com",         greenhouseSlug: "intercom" },
  { name: "Zendesk",          website: "https://zendesk.com",          greenhouseSlug: "zendesk" },
  { name: "Clio",             website: "https://clio.com",             greenhouseSlug: "clio" },
  { name: "Benchling",        website: "https://benchling.com",        greenhouseSlug: "benchling" },
  { name: "Gem",              website: "https://gem.com",              greenhouseSlug: "gem" },

  // ── Lever ──────────────────────────────────────────────────────────────────
  // Verified slugs: api.lever.co/v0/postings/{site}

  // AI & ML
  { name: "OpenAI",           website: "https://openai.com",           leverSite: "openai" },
  { name: "Perplexity",       website: "https://perplexity.ai",        leverSite: "perplexity" },
  { name: "Cursor",           website: "https://cursor.com",           leverSite: "anysphere" },
  { name: "Replit",           website: "https://replit.com",           leverSite: "replit" },
  { name: "Runway",           website: "https://runwayml.com",         leverSite: "runwayml" },

  // Dev Tools & Infra
  { name: "Linear",           website: "https://linear.app",           leverSite: "linear" },
  { name: "Retool",           website: "https://retool.com",           leverSite: "retool" },
  { name: "Render",           website: "https://render.com",           leverSite: "render" },
  { name: "Supabase",         website: "https://supabase.com",         leverSite: "supabase" },
  { name: "Planetscale",      website: "https://planetscale.com",      leverSite: "planetscale" },
  { name: "Dbt Labs",         website: "https://getdbt.com",           leverSite: "dbtlabs" },
  { name: "Airbyte",          website: "https://airbyte.com",          leverSite: "airbyte" },

  // Fintech
  { name: "Ramp",             website: "https://ramp.com",             leverSite: "ramp" },
  { name: "Mercury",          website: "https://mercury.com",          leverSite: "mercury" },
  { name: "Pilot",            website: "https://pilot.com",            leverSite: "pilot" },

  // Productivity & Collaboration
  { name: "Coda",             website: "https://coda.io",              leverSite: "coda" },
  { name: "Webflow",          website: "https://webflow.com",          leverSite: "webflow" },
  { name: "Pitch",            website: "https://pitch.com",            leverSite: "pitch" },

  // Other
  { name: "Lyft",             website: "https://lyft.com",             leverSite: "lyft" },
  { name: "Reddit",           website: "https://reddit.com",           leverSite: "reddit" },
  { name: "Calm",             website: "https://calm.com",             leverSite: "calm" },
  { name: "Ro Health",        website: "https://ro.co",                leverSite: "ro" },
  { name: "Front",            website: "https://front.com",            leverSite: "front" },
  { name: "Lob",              website: "https://lob.com",              leverSite: "lob" },
  { name: "Superhuman",       website: "https://superhuman.com",       leverSite: "superhuman" },
  { name: "Persona",          website: "https://withpersona.com",      leverSite: "persona" },
  { name: "Checkr",           website: "https://checkr.com",           leverSite: "checkr" },

  // ── Ashby ──────────────────────────────────────────────────────────────────
  // Verified slugs: api.ashbyhq.com/posting-api/job-board/{boardId}
  // jobs.ashbyhq.com/{boardId}

  // AI & ML (Ashby is very popular with AI-native companies)
  { name: "xAI",              website: "https://x.ai",                 ashbyBoardId: "xai" },
  { name: "Mistral",          website: "https://mistral.ai",           ashbyBoardId: "mistralai" },
  { name: "ElevenLabs",       website: "https://elevenlabs.io",        ashbyBoardId: "elevenlabs" },
  { name: "Pika",             website: "https://pika.art",             ashbyBoardId: "pika" },
  { name: "Together AI",      website: "https://together.ai",          ashbyBoardId: "togetherai" },
  { name: "Cognition",        website: "https://cognition.ai",         ashbyBoardId: "cognition" },
  { name: "Imbue",            website: "https://imbue.com",            ashbyBoardId: "imbue" },
  { name: "Poolside",         website: "https://poolside.ai",          ashbyBoardId: "poolside" },
  { name: "Magic",            website: "https://magic.dev",            ashbyBoardId: "magic" },
  { name: "Chai Discovery",   website: "https://chaidiscovery.com",    ashbyBoardId: "chaidiscovery" },

  // Dev Tools & Infra
  { name: "PostHog",          website: "https://posthog.com",          ashbyBoardId: "posthog" },
  { name: "Turso",            website: "https://turso.tech",           ashbyBoardId: "turso" },
  { name: "Neon",             website: "https://neon.tech",            ashbyBoardId: "neon" },
  { name: "Inngest",          website: "https://inngest.com",          ashbyBoardId: "inngest" },
  { name: "Trigger.dev",      website: "https://trigger.dev",          ashbyBoardId: "triggerdev" },
  { name: "Resend",           website: "https://resend.com",           ashbyBoardId: "resend" },
  { name: "Unkey",            website: "https://unkey.dev",            ashbyBoardId: "unkey" },

  // Fintech
  { name: "Deel",             website: "https://deel.com",             ashbyBoardId: "deel" },
  { name: "Ripple",           website: "https://ripple.com",           ashbyBoardId: "ripple" },
  { name: "Rho",              website: "https://rho.co",               ashbyBoardId: "rho" },

  // Other
  { name: "Shopify",          website: "https://shopify.com",          ashbyBoardId: "shopify" },
  { name: "Vercel (Ashby)",   website: "https://vercel.com",           ashbyBoardId: "vercel" },
  { name: "Liveblocks",       website: "https://liveblocks.io",        ashbyBoardId: "liveblocks" },
  { name: "Stytch",           website: "https://stytch.com",           ashbyBoardId: "stytch" },
  { name: "Dopt",             website: "https://dopt.com",             ashbyBoardId: "dopt" },
  { name: "Campsite",         website: "https://campsite.design",      ashbyBoardId: "campsite" },
];

export async function seedCompanies(prisma: PrismaClient) {
  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const company of companies) {
    try {
      const existing = await prisma.company.findFirst({
        where: { name: company.name },
      });

      if (existing) {
        await prisma.company.update({
          where: { id: existing.id },
          data: company,
        });
        updated++;
      } else {
        await prisma.company.create({ data: company });
        created++;
      }
    } catch (err) {
      console.error(`  ✗ Failed to seed ${company.name}:`, err);
      failed++;
    }
  }

  console.log(
    `Companies seeded — created: ${created}, updated: ${updated}, failed: ${failed}`
  );
}