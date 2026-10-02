import { Icon } from '@/components/ui/icon';
import { features } from '../content';
import { Section, SectionHeading } from '../section';

export function Features() {
  return (
    <Section id="features" tone="low">
      <SectionHeading title={features.title} description={features.description} />
      <div className="grid grid-cols-1 gap-5 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
        {features.items.map((feature) => (
          <article
            key={feature.eyebrow}
            className="group rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-sm transition-all duration-300 hover:border-secondary/50 hover:shadow-md sm:p-8"
          >
            <div className="mb-6 flex size-12 items-center justify-center rounded-lg bg-surface-container text-primary-container transition-colors group-hover:bg-secondary/10 group-hover:text-secondary">
              <Icon name={feature.icon} className="size-6" />
            </div>
            <p className="mb-2 text-label-sm text-secondary uppercase">{feature.eyebrow}</p>
            <h3 className="mb-3 font-serif text-headline-sm text-on-surface">{feature.title}</h3>
            <p className="text-body-md text-on-surface-variant">{feature.description}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}
