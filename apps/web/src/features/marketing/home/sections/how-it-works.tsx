import { howItWorks } from '../content';
import { Section, SectionHeading } from '../section';

export function HowItWorks() {
  return (
    <Section id="how-it-works" tone="surface">
      <SectionHeading
        eyebrow={howItWorks.eyebrow}
        title={howItWorks.title}
        description={howItWorks.description}
        lead="md"
      />
      <ol className="grid grid-cols-1 gap-5 sm:gap-8 md:grid-cols-3">
        {howItWorks.steps.map((step) => (
          <li
            key={step.number}
            className="relative rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm transition-all hover:border-secondary/40 sm:p-8"
          >
            <p
              aria-hidden="true"
              className="mb-4 font-serif text-headline-lg font-bold text-secondary/30"
            >
              {step.number}
            </p>
            <h3 className="mb-3 font-serif text-headline-sm text-on-surface">{step.title}</h3>
            <p className="text-body-md text-on-surface-variant">{step.description}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
