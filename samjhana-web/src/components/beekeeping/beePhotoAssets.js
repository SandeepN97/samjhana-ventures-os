import honeyPhoto from '../../assets/real/honey-jar.jpg';
import hivePhoto from '../../assets/real/hive-boxes.jpg';
import suitPhoto from '../../assets/real/protective-suit.webp';
import toolsPhoto from '../../assets/real/smoker-tools.jpg';
import starterKitPhoto from '../../assets/real/starter-kit-product.jpg';
import logHivePhoto from '../../assets/real/log-hive.jpg';
import nucleusPhoto from '../../assets/real/nucleus-box.jpg';
import framesPhoto from '../../assets/real/hive-frames.jpg';
import veilPhoto from '../../assets/real/round-veil-cap.jpg';
import gauntletPhoto from '../../assets/real/leather-gauntlet-gloves.jpg';
import nitrilePhoto from '../../assets/real/nitrile-gloves.jpg';
import extractorPhoto from '../../assets/real/honey-extractor.jpg';
import foundationPhoto from '../../assets/real/beeswax-foundation.png';
import honeycombPhoto from '../../assets/real/capped-honeycomb.jpg';
import jToolPhoto from '../../assets/real/j-hive-tool.jpg';
import queenMarkingPhoto from '../../assets/real/queen-marking-cage.png';
import queenCapturePhoto from '../../assets/real/queen-capture-cage.webp';
import completeKitPhoto from '../../assets/real/complete-kit-product.jpg';
import basicKitPhoto from '../../assets/real/basic-kit-product.jpg';

const PRODUCT_PHOTOS = {
  'hive-001': hivePhoto,
  'hive-002': logHivePhoto,
  'hive-003': nucleusPhoto,
  'hive-004': framesPhoto,
  'gear-001': suitPhoto,
  'gear-002': suitPhoto,
  'gear-003': veilPhoto,
  'gear-004': gauntletPhoto,
  'gear-005': nitrilePhoto,
  'tool-001': toolsPhoto,
  'tool-002': jToolPhoto,
  'tool-003': queenCapturePhoto,
  'tool-004': queenMarkingPhoto,
  'tool-005': framesPhoto,
  'tool-006': toolsPhoto,
  'tool-007': extractorPhoto,
  'tool-008': toolsPhoto,
  'tool-009': foundationPhoto,
  'tool-010': framesPhoto,
  'honey-001': honeyPhoto,
  'honey-002': honeyPhoto,
  'honey-003': foundationPhoto,
  'honey-004': honeycombPhoto,
  'kit-001': basicKitPhoto,
  'kit-002': completeKitPhoto,
  'kit-003': extractorPhoto,
};

export function getBeePhoto(id = '') {
  return PRODUCT_PHOTOS[id] ?? starterKitPhoto;
}
