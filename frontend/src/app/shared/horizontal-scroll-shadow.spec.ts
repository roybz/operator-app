import { computeHorizontalScrollShadowState } from './horizontal-scroll-shadow';

describe('computeHorizontalScrollShadowState', () => {
  it('shows only right shadow when at hard left with horizontal overflow', () => {
    const state = computeHorizontalScrollShadowState({
      scrollWidth: 1000,
      clientWidth: 400,
      scrollLeft: 0,
    });
    expect(state).toEqual({ showLeft: false, showRight: true });
  });

  it('shows only left shadow when at hard right with horizontal overflow', () => {
    const state = computeHorizontalScrollShadowState({
      scrollWidth: 1000,
      clientWidth: 400,
      scrollLeft: 600,
    });
    expect(state).toEqual({ showLeft: true, showRight: false });
  });

  it('shows both shadows when between edges', () => {
    const state = computeHorizontalScrollShadowState({
      scrollWidth: 1000,
      clientWidth: 400,
      scrollLeft: 200,
    });
    expect(state).toEqual({ showLeft: true, showRight: true });
  });

  it('shows no shadows when content does not overflow', () => {
    const state = computeHorizontalScrollShadowState({
      scrollWidth: 400,
      clientWidth: 400,
      scrollLeft: 0,
    });
    expect(state).toEqual({ showLeft: false, showRight: false });
  });
});
