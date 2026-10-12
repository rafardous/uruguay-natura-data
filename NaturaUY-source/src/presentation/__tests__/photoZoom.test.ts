import { clampPhotoOffset, photoZoomBounds } from '../photoZoom';

test('una foto horizontal sólo se desplaza en los ejes que exceden el visor', () => {
  expect(photoZoomBounds(300, 600, 2, 3)).toEqual({ x: 300, y: 0 });
  expect(clampPhotoOffset(1000, 300)).toBe(300);
  expect(clampPhotoOffset(-1000, 300)).toBe(-300);
});

test('una foto vertical conserva sus márgenes hasta que el zoom llena el ancho', () => {
  expect(photoZoomBounds(300, 600, 0.25, 2)).toEqual({ x: 0, y: 300 });
  expect(photoZoomBounds(300, 600, 0.25, 3)).toEqual({ x: 75, y: 600 });
});

test('el encuadre original queda centrado y no se desplaza antes del layout', () => {
  expect(photoZoomBounds(300, 600, 2, 1)).toEqual({ x: 0, y: 0 });
  expect(photoZoomBounds(0, 0, 2, 3)).toEqual({ x: 0, y: 0 });
  expect(photoZoomBounds(300, 600, 0, 2)).toEqual({ x: 150, y: 300 });
});
