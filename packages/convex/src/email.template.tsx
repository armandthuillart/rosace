import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

import { env } from "./env";

interface WelcomeProps {
  firstName: string;
}

export function Welcome({ firstName }: WelcomeProps) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="mx-auto my-0 bg-white font-sans">
          <Preview>Welcome to Rosace, {firstName}!</Preview>
          <Container className="mx-auto my-0 px-5 py-0">
            <Heading className="mx-0 my-[30px] p-0 text-4xl leading-[42px] font-bold text-[#1d1c1d]">
              Welcome to Rosace
            </Heading>

            <Text className="mb-7.5 text-xl">Hi {firstName},</Text>

            <Text className="mb-7.5 text-xl leading-7 text-[#353535]">
              We're thrilled to have you on board. Rosace is your new dashboard for managing
              everything — we can't wait to see what you'll build.
            </Text>

            <Section className="mb-[30px] text-center">
              <Link
                className="inline-block rounded bg-[#1d1c1d] px-6 py-3 text-base font-medium text-white no-underline"
                href={env.DASHBOARD_URL}
              >
                Get started
              </Link>
            </Section>

            <Text className="text-sm leading-6 text-[#353535]">
              If you have any questions, just reply to this email — we're always happy to help.
            </Text>

            <Section className="mt-[40px]">
              <Link
                className="text-[#b7b7b7] underline"
                href={`${env.MARKETING_URL}/terms-of-service`}
                rel="noopener noreferrer"
                target="_blank"
              >
                Terms of Service
              </Link>
              &nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
              <Link
                className="text-[#b7b7b7] underline"
                href={`${env.MARKETING_URL}/privacy-policy`}
                rel="noopener noreferrer"
                target="_blank"
              >
                Privacy Policy
              </Link>
              &nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
              <Link
                className="text-[#b7b7b7] underline"
                href={`${env.MARKETING_URL}/legal-notice`}
                rel="noopener noreferrer"
                target="_blank"
              >
                Legal Notice
              </Link>
              <Text className="mb-[50px] text-left text-xs leading-[15px] text-[#b7b7b7]">
                ©{new Date().getFullYear()} Neap.
                <br />
                All rights reserved.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
