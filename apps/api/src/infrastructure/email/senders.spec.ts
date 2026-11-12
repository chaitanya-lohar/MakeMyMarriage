import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmailRejectedError, type EmailMessage } from './email-message.js';
import { BrevoEmailSender } from './senders.js';

const message: EmailMessage = {
  to: 'guest@example.com',
  subject: 'You are invited',
  html: '<p>Hello</p>',
  text: 'Hello',
};

function stubFetch(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('BrevoEmailSender', () => {
  const sender = new BrevoEmailSender('xkeysib-test', {
    name: 'MakeMyMarriage',
    address: 'sender@example.com',
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the message to Brevo and returns its message ID', async () => {
    const fetchMock = stubFetch(201, { messageId: '<abc@relay.example>' });

    await expect(sender.send(message)).resolves.toEqual({
      providerMessageId: '<abc@relay.example>',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'api-key': 'xkeysib-test' });
    expect(JSON.parse(init.body as string)).toEqual({
      sender: { email: 'sender@example.com', name: 'MakeMyMarriage' },
      to: [{ email: 'guest@example.com' }],
      subject: 'You are invited',
      htmlContent: '<p>Hello</p>',
      textContent: 'Hello',
    });
  });

  it('leaves the sender name out when none is configured', async () => {
    const fetchMock = stubFetch(201, {});
    const unnamed = new BrevoEmailSender('xkeysib-test', {
      name: null,
      address: 'sender@example.com',
    });

    await expect(unnamed.send(message)).resolves.toEqual({ providerMessageId: null });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({
      sender: { email: 'sender@example.com' },
    });
  });

  it('reports a 4xx answer as a rejection, keeping only the error code', async () => {
    stubFetch(400, { code: 'invalid_parameter', message: 'guest@example.com is not valid' });

    const error = await sender.send(message).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(EmailRejectedError);
    expect((error as EmailRejectedError).reason).toBe('Brevo HTTP 400: invalid_parameter');
    expect((error as Error).message).not.toContain('guest@example.com');
  });

  it('treats rate limiting and server errors as temporary failures', async () => {
    for (const status of [429, 500]) {
      stubFetch(status, { code: 'too_many_requests' });

      const error = await sender.send(message).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(EmailRejectedError);
      expect((error as Error).message).toBe(`Brevo failed with HTTP ${status}`);
    }
  });
});
