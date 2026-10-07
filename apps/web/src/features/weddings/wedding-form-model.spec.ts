import { describe, expect, it } from 'vitest';
import {
  emptyWeddingForm,
  errorsFromApi,
  formFromWedding,
  previewDisplayName,
  toWeddingPayload,
  validateWeddingForm,
} from './wedding-form-model';

const filled = {
  ...emptyWeddingForm,
  brideName: 'Meera Sharma',
  groomName: 'Arjun Patel',
};

describe('wedding form', () => {
  it('needs only the two names', () => {
    expect(validateWeddingForm(filled)).toEqual({});
    expect(validateWeddingForm({ ...emptyWeddingForm, brideName: '  ' })).toEqual({
      brideName: "Enter the bride's name.",
      groomName: "Enter the groom's name.",
    });
  });

  it('applies the approved limits and date check', () => {
    expect(
      validateWeddingForm({
        ...filled,
        groomName: 'A'.repeat(101),
        startDate: '32 / 13 / 2027',
        venueName: 'V'.repeat(120),
        primaryCity: 'C'.repeat(121),
        description: 'D'.repeat(1001),
      }),
    ).toEqual({
      groomName: 'Use 100 characters or fewer.',
      startDate: 'Enter a valid date.',
      primaryCity: 'Use 120 characters or fewer.',
      description: 'Use 1,000 characters or fewer.',
    });
  });

  it('previews the display name only when both names are filled in', () => {
    expect(previewDisplayName(filled)).toBe('Meera Sharma & Arjun Patel');
    expect(previewDisplayName({ ...filled, groomName: ' ' })).toBeNull();
  });

  it('sends trimmed values, an ISO date and null for empty optional fields', () => {
    expect(
      toWeddingPayload({ ...filled, brideName: ' Meera Sharma ', startDate: '18/02/2027' }),
    ).toEqual({
      brideName: 'Meera Sharma',
      groomName: 'Arjun Patel',
      startDate: '2027-02-18',
      venueName: null,
      primaryCity: null,
      description: null,
    });
  });

  it('round-trips a saved wedding into the form', () => {
    expect(
      formFromWedding({
        id: 'w1',
        displayName: 'Meera Sharma & Arjun Patel',
        brideName: 'Meera Sharma',
        groomName: 'Arjun Patel',
        startDate: '2027-02-18',
        venueName: null,
        primaryCity: 'Jaipur',
        description: null,
        timezone: 'Asia/Kolkata',
      }),
    ).toEqual({ ...filled, startDate: '18 / 02 / 2027', primaryCity: 'Jaipur' });
  });

  it('maps API field errors onto the form', () => {
    expect(errorsFromApi({ startDate: ['Enter a valid date.'], other: ['x'] })).toEqual({
      startDate: 'Enter a valid date.',
    });
  });
});
