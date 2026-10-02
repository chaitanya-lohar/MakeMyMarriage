import type { Job } from 'bullmq';
import type { PinoLogger } from 'nestjs-pino';
import { describe, expect, it, vi } from 'vitest';
import type { EmailMessage } from './email-message.js';
import { EmailProcessor } from './email.processor.js';

const message: EmailMessage = { to: 'a@example.com', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' };
const info = vi.fn();
const logger = { setContext: vi.fn(), info } as unknown as PinoLogger;

describe('EmailProcessor', () => {
  it('sends queued messages without logging their recipient or content', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const processor = new EmailProcessor({ send }, logger);

    await processor.process({ id: '1', name: 'send', data: message } as Job<EmailMessage>);

    expect(send).toHaveBeenCalledWith(message);
    expect(JSON.stringify(info.mock.calls)).not.toContain('a@example.com');
  });

  it('fails unknown job names so they are not silently dropped', async () => {
    const send = vi.fn();
    const processor = new EmailProcessor({ send }, logger);
    await expect(
      processor.process({
        id: '2',
        name: 'other',
        queueName: 'email',
        data: message,
      } as Job<EmailMessage>),
    ).rejects.toThrow(/Unknown job/);
    expect(send).not.toHaveBeenCalled();
  });
});
