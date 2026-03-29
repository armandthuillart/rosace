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
import { getEnv } from "../env";

const env = getEnv();

type OTPType = "sign-in" | "reset-password" | "change-email";

interface OTPProps {
  otp: string;
  type: OTPType;
}

const PREVIEW_BY_TYPE: Record<OTPType, string> = {
  "change-email": "Change your email",
  "reset-password": "Reset your password",
  "sign-in": "Your code to sign in",
};

const HEADING_BY_TYPE: Record<OTPType, string> = {
  "change-email": "Change your email",
  "reset-password": "Reset your password",
  "sign-in": "Your code to sign in",
};

const ACTION_BY_TYPE: Record<OTPType, string> = {
  "change-email": "change your email",
  "reset-password": "reset your password",
  "sign-in": "sign in to your account",
};

export function OTP({ otp, type }: OTPProps) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="mx-auto my-0 bg-white">
          <Preview>{PREVIEW_BY_TYPE[type]}</Preview>
          <Container className="mx-auto my-0 px-5 py-0">
            <Heading className="mx-0 my-[30px] p-0 font-bold text-4xl text-[#1d1c1d] leading-[42px]">
              {HEADING_BY_TYPE[type]}
            </Heading>

            <Text className="mb-7.5 text-xl">
              Your confirmation code is below - enter it in your open browser window and we'll help
              you {ACTION_BY_TYPE[type]}.
            </Text>

            <Section className="mb-[30px] rounded bg-[rgb(245,244,245)] px-[10px] py-10">
              <Text className="text-center align-middle text-3xl leading-[24px]">{otp}</Text>
            </Section>

            <Text className="text-black text-sm leading-6">
              If you didn't request this email, there's nothing to worry about, you can safely
              ignore it.
            </Text>

            <Section>
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
              <Text className="mb-[50px] text-left text-[#b7b7b7] text-xs leading-[15px]">
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
