import { z } from "zod";

export const SessionUserSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1).max(120).optional()
});

export const LiffExchangeResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("authenticated"),
    user: SessionUserSchema,
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    accessTokenExpiresIn: z.number().int().positive().max(86_400)
  }),
  z.object({
    status: z.literal("link_required"),
    challengeId: z.string().min(1).max(256)
  }),
  z.object({
    status: z.literal("onboarding_required"),
    challengeId: z.string().min(1).max(256)
  })
]);

export type SessionUser = z.infer<typeof SessionUserSchema>;
export type LiffExchangeResponse = z.infer<typeof LiffExchangeResponseSchema>;
export type PublicLiffSession =
  | { status: "authenticated"; user: SessionUser }
  | { status: "link_required"; challengeId: string }
  | { status: "onboarding_required"; challengeId: string };
