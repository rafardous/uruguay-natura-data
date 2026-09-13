import { orderPhylumOptions } from '../taxonOrdering';

describe('orderPhylumOptions', () => {
  it('keeps Chordata before Arthropoda and leaves other phyla alphabetical', () => {
    const result = orderPhylumOptions([
      { value: 'Mollusca' },
      { value: 'Arthropoda' },
      { value: 'Chordata' },
      { value: 'Cnidaria' },
    ]);

    expect(result.map((item) => item.value)).toEqual(['Chordata', 'Arthropoda', 'Cnidaria', 'Mollusca']);
  });

  it('does not mutate the repository result', () => {
    const input = [{ value: 'Arthropoda' }, { value: 'Chordata' }];
    orderPhylumOptions(input);
    expect(input.map((item) => item.value)).toEqual(['Arthropoda', 'Chordata']);
  });
});
