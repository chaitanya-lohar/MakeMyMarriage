import { Icon } from '@/components/ui/icon';
import { privacy } from '../content';
import { Section, SectionHeading } from '../section';

export function Privacy() {
  return (
    <Section tone="low">
      <SectionHeading
        eyebrow={privacy.eyebrow}
        title={privacy.title}
        description={privacy.description}
        lead="md"
      />
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
        {privacy.items.map((item) => (
          <article
            key={item.title}
            className="space-y-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6"
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-surface-container text-secondary">
              <Icon name={item.icon} className="size-6" />
            </div>
            <h3 className="text-title-md text-on-surface">{item.title}</h3>
            <p className="text-xs leading-relaxed text-on-surface-variant">{item.description}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}
