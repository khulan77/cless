/**
 * SMS — энэ ээлжинд ИЛГЭЭХГҮЙ. Provider-ийн interface-ийг л бэлдэв.
 * TODO(sms): Монгол SMS gateway (жишээ нь Unitel/Mobicom-ийн API) сонгож, SmsProvider-ийг хэрэгжүүлж,
 * outbox-д SMS job type-ийг (JobType.SMS аль хэдийн бий) ашиглан цагийн сануулга илгээх.
 */
export type SmsMessage = { to: string; text: string; id: string };

export interface SmsProvider {
  send(message: SmsMessage): Promise<{ ref: string }>;
}

/** Одоогоор юу ч илгээхгүй */
export class NoopSmsProvider implements SmsProvider {
  async send(message: SmsMessage) {
    return { ref: `noop:${message.id}` };
  }
}

export function getSmsProvider(): SmsProvider {
  return new NoopSmsProvider();
}
