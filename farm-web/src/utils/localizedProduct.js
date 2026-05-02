const PRODUCT_NAME_MAP = {
  hi: {
    'local cucumber': 'स्थानीय खीरा',
    'sweet and juicy mangoes': 'मीठे और रसदार आम',
    'orange - terai': 'संतरा - तराई',
    'orange - terau': 'संतरा - तराई',
    spinach: 'पालक',
    apple: 'सेब',
    'fresh farm apples': 'फ्रेश फार्म सेब',
    'green apples': 'हरे सेब',
    'peas straight from the vine': 'ताज़ी बेल से मटर',
    'sweet pineapples': 'मीठा अनानास',
    'strawberries from maleku': 'मालेकू की स्ट्रॉबेरी',
    'green cabbage': 'हरी पत्ता गोभी',
    'spicy and vibrant chili peppers': 'मसालेदार और ताज़ी मिर्च',
    "solukhumbu's potato": 'सोलुखुम्बु का आलू',
    'fresh watermelons': 'ताज़ा तरबूज',
    "farm-grade cow's milk": 'फार्म ताज़ा गाय का दूध',
    'fresh and vibrant broccoli': 'ताज़ी और कुरकुरी ब्रोकोली',
    'tender and versatile tofu': 'नरम और बहुउपयोगी टोफू',
    'tangy and sweet kiwi': 'खट्टा-मीठा कीवी',
    'red potato (terai)': 'लाल आलू (तराई)',
    'red indian onions': 'लाल भारतीय प्याज',
    'chinese spinach': 'चीनी पालक',
    cauliflower: 'फूलगोभी',
    peas: 'मटर'
  },
  te: {
    'local cucumber': 'స్థానిక దోసకాయ',
    'sweet and juicy mangoes': 'తీపి మరియు రసాల మామిడిపండ్లు',
    'orange - terai': 'నారింజ - తరాయి',
    'orange - terau': 'నారింజ - తరాయి',
    spinach: 'పాలకూర',
    apple: 'ఆపిల్',
    'fresh farm apples': 'తాజా ఫార్మ్ ఆపిల్స్',
    'green apples': 'పచ్చ ఆపిల్స్',
    'peas straight from the vine': 'తాజా తీగ మటర్',
    'sweet pineapples': 'తీపి అనాసపండ్లు',
    'strawberries from maleku': 'మలేకు నుంచి స్ట్రాబెర్రీలు',
    'green cabbage': 'పచ్చ క్యాబేజీ',
    'spicy and vibrant chili peppers': 'కారం మరియు సువాసన గల మిరపకాయలు',
    "solukhumbu's potato": 'సోలుఖుంబు బంగాళదుంప',
    'fresh watermelons': 'తాజా పుచ్చకాయలు',
    "farm-grade cow's milk": 'ఫార్మ్ తాజా ఆవు పాలు',
    'fresh and vibrant broccoli': 'తాజా మరియు కురకురల బరోకొలి',
    'tender and versatile tofu': 'మృదువైన మరియు బహుముఖ టోఫు',
    'tangy and sweet kiwi': 'పులుపు-తీపి కివీ',
    'red potato (terai)': 'ఎర్ర బంగాళదుంప (తరాయి)',
    'red indian onions': 'ఎర్ర భారతీయ ఉల్లిపాయలు',
    'chinese spinach': 'చైనీస్ పాలకూర',
    cauliflower: 'కాలీఫ్లవర్',
    peas: 'బటానీలు'
  }
};

const normalizeName = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

export const translateProductName = (name, language = 'en') => {
  if (!name || language === 'en') {
    return name || '';
  }

  const normalized = normalizeName(name);
  return PRODUCT_NAME_MAP[language]?.[normalized] || name;
};

export const getLocalizedProductName = (product, language = 'en') => {
  if (!product) return '';

  const hiName = String(product.name_hi || '').trim();
  const teName = String(product.name_te || '').trim();
  const defaultName = String(product.name || '').trim();

  if (language === 'hi' && hiName) return hiName;
  if (language === 'te' && teName) return teName;

  return translateProductName(defaultName, language);
};
