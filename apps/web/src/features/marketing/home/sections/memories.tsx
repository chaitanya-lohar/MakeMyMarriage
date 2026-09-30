import Image from 'next/image';
import { Icon } from '@/components/ui/icon';
import { memories } from '../content';
import { Section } from '../section';

export function Memories() {
  return (
    <Section id="memories" tone="low">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="space-y-4 lg:col-span-6">
          <div className="overflow-hidden rounded-2xl border border-secondary/30 bg-surface-container-lowest p-2 shadow-xl">
            <Image
              src={memories.image.src}
              alt={memories.image.alt}
              width={memories.image.width}
              height={memories.image.height}
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="h-[260px] w-full rounded-xl object-cover object-center sm:h-[400px]"
            />
          </div>
          <div className="flex items-center justify-between px-2 text-xs text-on-surface-variant">
            {memories.captions.map((caption) => (
              <span key={caption}>{caption}</span>
            ))}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-6">
          <p className="inline-flex items-center rounded-full border border-secondary/30 bg-surface-container px-3.5 py-1.5 text-label-sm text-secondary uppercase">
            {memories.eyebrow}
          </p>
          <h2 className="font-serif text-headline-lg-mobile text-on-surface md:text-headline-lg">
            {memories.titleLines[0]}
            <br />
            {memories.titleLines[1]}
          </h2>
          <p className="text-body-md text-on-surface-variant sm:text-body-lg">
            {memories.description}
          </p>

          <div className="flex flex-col items-center gap-5 rounded-2xl border border-secondary/40 bg-surface-container-lowest p-5 shadow-md sm:flex-row sm:gap-6 sm:p-6">
            <div className="flex size-28 shrink-0 items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container">
              <Icon name="qr_code_2" className="size-12 text-primary-container" />
            </div>
            <div className="space-y-2 text-center sm:text-left">
              <p className="text-label-sm text-secondary uppercase">{memories.qrCard.eyebrow}</p>
              <h3 className="text-title-md font-bold text-on-surface">{memories.qrCard.title}</h3>
              <p className="text-xs text-on-surface-variant">{memories.qrCard.body}</p>
            </div>
          </div>

          {/* The design shows these as one dotted line; a list keeps them readable when wrapped. */}
          <ul className="flex flex-wrap gap-x-2 gap-y-1 pt-2 text-xs leading-relaxed font-medium text-on-surface">
            {memories.highlights.map((highlight, index) => (
              <li key={highlight} className="flex items-center gap-2">
                {highlight}
                {index < memories.highlights.length - 1 && <span aria-hidden="true">·</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
