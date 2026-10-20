import { getItem } from '../data/catalog.js'

// Map COCO-SSD class names to our recycling catalog.
// Recyclable classes resolve to a catalog itemId; others are "not accepted".
export const COCO_TO_ITEM = {
  bottle: 'pet-bottle',
  'wine glass': 'pet-bottle',
  cup: 'paper-carton',
  book: 'paper-carton',
  'cell phone': 'ewaste-small',
  remote: 'ewaste-small',
  keyboard: 'ewaste-small',
  mouse: 'ewaste-small',
  laptop: 'ewaste-small',
}

export const MIN_SCORE = 0.55

let modelPromise = null

// Lazy-load TF.js + COCO-SSD once and cache the model.
export async function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const [{ load }, tf] = await Promise.all([
        import('@tensorflow-models/coco-ssd'),
        import('@tensorflow/tfjs'),
      ])
      await tf.ready()
      return load({ base: 'lite_mobilenet_v2' })
    })()
  }
  return modelPromise
}

// Turn a raw COCO prediction into a verdict object for our app.
export function toDetection(pred) {
  const mapped = COCO_TO_ITEM[pred.class]
  const item = mapped ? getItem(mapped) : null
  return {
    class: pred.class,
    label: item ? item.name : pred.class,
    itemId: mapped || null,
    recyclable: Boolean(mapped),
    confidence: Math.round(pred.score * 100),
    bbox: pred.bbox,
  }
}
