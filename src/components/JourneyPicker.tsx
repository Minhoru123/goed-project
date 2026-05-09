import { JOURNEY_BY_PHASE, JOURNEY_STEPS, type JourneyPhase } from '../lib/journey';

interface Props {
  value: number | null;
  onChange: (n: number | null) => void;
}

const PHASES: JourneyPhase[] = ['Thinking', 'Starting', 'Growing', 'Exit'];

export default function JourneyPicker({ value, onChange }: Props) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-utah-stone/80">
          Where are you in the 19-step Utah entrepreneur journey?
        </p>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-utah-gold hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <div className="space-y-2">
        {PHASES.map((phase) => (
          <div key={phase}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-utah-stone/85">
              {phase}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {JOURNEY_BY_PHASE[phase].map((step) => {
                const selected = value === step.n;
                return (
                  <button
                    key={step.n}
                    type="button"
                    onClick={() => onChange(selected ? null : step.n)}
                    className={`group flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${
                      selected
                        ? 'border-utah-gold bg-utah-gold/15 text-utah-gold'
                        : 'border-utah-stone/15 text-utah-stone/80 hover:border-utah-gold/50 hover:text-utah-stone'
                    }`}
                    title={`Step ${step.n}: ${step.title}`}
                  >
                    <span className={`font-mono font-bold ${selected ? 'text-utah-gold' : 'text-utah-stone/85 group-hover:text-utah-gold'}`}>
                      {step.n}
                    </span>
                    <span className="hidden sm:inline">{step.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {value !== null && (
        <p className="mt-3 text-xs text-utah-stone/85">
          You're at <strong className="text-utah-gold">Step {value}: {JOURNEY_STEPS[value - 1].title}</strong>.
          Matches will be tailored to this step.
        </p>
      )}
    </div>
  );
}
