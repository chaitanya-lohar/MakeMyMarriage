import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { ceremonies } from '../content';
import { Section, SectionHeading } from '../section';

export function Ceremonies() {
  return (
    <Section id="ceremonies" tone="low">
      <SectionHeading
        align="start"
        eyebrow={ceremonies.eyebrow}
        title={ceremonies.title}
        description={ceremonies.description}
      />
      <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {ceremonies.items.map((ceremony) => (
          <article
            key={ceremony.label}
            className={`relative rounded-xl border bg-surface-container-lowest p-5 shadow-sm transition-all hover:shadow-md sm:p-6 ${
              ceremony.highlighted ? 'border-secondary/40' : 'border-outline-variant/30'
            }`}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-label-sm text-secondary uppercase">{ceremony.label}</p>
              <Chip tone={ceremony.whenTone} className="text-xs">
                {ceremony.when}
              </Chip>
            </div>
            <h3 className="text-title-lg font-bold text-on-surface">{ceremony.name}</h3>
            <p className="mt-1 text-body-sm text-on-surface-variant">{ceremony.description}</p>
            <ul className="mt-4 space-y-2 border-t border-outline-variant/20 pt-4 text-xs text-on-surface-variant">
              {ceremony.details.map((detail) => (
                <li key={detail.text} className="flex items-center gap-2">
                  <Icon name={detail.icon} className="size-4 text-secondary" />
                  {detail.text}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </Section>
  );
}
