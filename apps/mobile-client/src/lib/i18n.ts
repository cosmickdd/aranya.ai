import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';

const translations = {
  en: {
    welcome: 'Welcome Back',
    language: 'English',
    select_language: 'Select Language',
    continue: 'Continue',
    onboarding_1_title: 'Protect Our Earth',
    onboarding_1_subtitle: 'Make the earth a map to real life. Life can be better if it is in the right hands and free from air and factory pollution.',
    onboarding_2_title: 'Modern Farming',
    onboarding_2_subtitle: 'Discover a better way for Modern Farmer. Connect with markets and weather in real time.',
    onboarding_3_title: 'Grow Together',
    onboarding_3_subtitle: 'Join the community of thousands of farmers across the country and grow your yield.',
  },
  hi: {
    welcome: 'वापसी पर स्वागत है',
    language: 'हिंदी',
    select_language: 'भाषा चुनें',
    continue: 'जारी रखें',
    onboarding_1_title: 'हमारी पृथ्वी की रक्षा करें',
    onboarding_1_subtitle: 'पृथ्वी को वास्तविक जीवन का मानचित्र बनाएं। यदि यह सही हाथों में है और वायु व कारखानों के प्रदूषण से मुक्त है, तो जीवन बेहतर हो सकता है।',
    onboarding_2_title: 'आधुनिक खेती',
    onboarding_2_subtitle: 'आधुनिक किसान के लिए एक बेहतर तरीका खोजें। वास्तविक समय में बाज़ारों और मौसम से जुड़ें।',
    onboarding_3_title: 'एक साथ आगे बढ़ें',
    onboarding_3_subtitle: 'देश भर के हजारों किसानों के समुदाय में शामिल हों और अपनी उपज बढ़ाएं।',
  },
  ta: {
    welcome: 'மீண்டும் நல்வரவு',
    language: 'தமிழ்',
    select_language: 'மொழியைத் தேர்ந்தெடுக்கவும்',
    continue: 'தொடரவும்',
    onboarding_1_title: 'நமது பூமியைப் பாதுகாப்போம்',
    onboarding_1_subtitle: 'பூமியை நிஜ வாழ்க்கையின் வரைபடமாக்குங்கள். இது சரியான கைகளில் இருந்தால், காற்று மற்றும் தொழிற்சாலை மாசுபாட்டிலிருந்து விடுபட்டால் வாழ்க்கை சிறப்பாக இருக்கும்.',
    onboarding_2_title: 'நவீன விவசாயம்',
    onboarding_2_subtitle: 'நவீன விவசாயிகளுக்கான சிறந்த வழியைக் கண்டறியவும். சந்தைகள் மற்றும் வானிலையுடன் உண்மையான நேரத்தில் இணையுங்கள்.',
    onboarding_3_title: 'ஒன்றாக வளருவோம்',
    onboarding_3_subtitle: 'நாடு முழுவதும் உள்ள ஆயிரக்கணக்கான விவசாயிகளின் சமூகத்தில் இணைந்து உங்கள் மகசூலை அதிகரிக்கவும்.',
  },
  te: {
    welcome: 'తిరిగి స్వాగతం',
    language: 'తెలుగు',
    select_language: 'భాషను ఎంచుకోండి',
    continue: 'కొనసాగించు',
    onboarding_1_title: 'మన భూమిని రక్షించుకుందాం',
    onboarding_1_subtitle: 'భూమిని నిజ జీవితానికి మ్యాప్‌గా మార్చండి. ఇది సరైన చేతుల్లో ఉండి గాలి మరియు ఫ్యాక్టరీ కాలుష్యం నుండి విముక్తి పొందితే జీవితం మెరుగ్గా ఉంటుంది.',
    onboarding_2_title: 'ఆధునిక వ్యవసాయం',
    onboarding_2_subtitle: 'ఆధునిక రైతు కోసం మెరుగైన మార్గాన్ని కనుగొనండి. మార్కెట్లు మరియు వాతావరణంతో నిజ సమయంలో కనెక్ట్ అవ్వండి.',
    onboarding_3_title: 'కలిసి ఎదుగుదాం',
    onboarding_3_subtitle: 'దేశవ్యాప్తంగా ఉన్న వేలాది మంది రైతుల సంఘంలో చేరండి మరియు మీ దిగుబడిని పెంచుకోండి.',
  },
  mr: {
    welcome: 'पुन्हा स्वागत आहे',
    language: 'मराठी',
    select_language: 'भाषा निवडा',
    continue: 'पुढे जा',
    onboarding_1_title: 'आपल्या पृथ्वीचे रक्षण करा',
    onboarding_1_subtitle: 'पृथ्वीला वास्तविक जीवनाचा नकाशा बनवा. जर ते योग्य हातात असेल आणि हवा आणि कारखान्यांच्या प्रदूषणापासून मुक्त असेल तर जीवन चांगले होऊ शकते.',
    onboarding_2_title: 'आधुनिक शेती',
    onboarding_2_subtitle: 'आधुनिक शेतकऱ्यांसाठी एक चांगला मार्ग शोधा. बाजारपेठ आणि हवामानाशी रिअल-टाइममध्ये कनेक्ट व्हा.',
    onboarding_3_title: 'एकत्र वाढूया',
    onboarding_3_subtitle: 'देशभरातील हजारो शेतकऱ्यांच्या समुदायात सामील व्हा आणि तुमचे उत्पादन वाढवा.',
  },
  bn: {
    welcome: 'আবার স্বাগতম',
    language: 'বাংলা',
    select_language: 'ভাষা নির্বাচন করুন',
    continue: 'চালিয়ে যান',
    onboarding_1_title: 'আমাদের পৃথিবী রক্ষা করুন',
    onboarding_1_subtitle: 'পৃথিবীকে বাস্তব জীবনের মানচিত্র তৈরি করুন। এটি সঠিক হাতে থাকলে এবং বাতাস ও কারখানার দূষণ থেকে মুক্ত থাকলে জীবন আরও ভালো হতে পারে।',
    onboarding_2_title: 'আধুনিক কৃষি',
    onboarding_2_subtitle: 'আধুনিক কৃষকের জন্য একটি ভাল উপায় আবিষ্কার করুন। রিয়েল-টাইমে বাজার এবং আবহাওয়ার সাথে সংযুক্ত হন।',
    onboarding_3_title: 'একসাথে বেড়ে উঠুন',
    onboarding_3_subtitle: 'সারা দেশে হাজার হাজার কৃষকের সম্প্রদায়ে যোগ দিন এবং আপনার ফলন বৃদ্ধি করুন।',
  },
  gu: {
    welcome: 'ફરી સ્વાગત છે',
    language: 'ગુજરાતી',
    select_language: 'ભાષા પસંદ કરો',
    continue: 'ચાલુ રાખો',
    onboarding_1_title: 'આપણી પૃથ્વીનું રક્ષણ કરો',
    onboarding_1_subtitle: 'પૃથ્વીને વાસ્તવિક જીવનનો નકશો બનાવો. જો તે યોગ્ય હાથમાં હોય અને હવા અને ફેક્ટરીના પ્રદૂષણથી મુક્ત હોય તો જીવન વધુ સારું બની શકે છે.',
    onboarding_2_title: 'આધુનિક ખેતી',
    onboarding_2_subtitle: 'આધુનિક ખેડૂત માટે વધુ સારો રસ્તો શોધો. બજારો અને હવામાન સાથે રીઅલ-ટાઇમમાં કનેક્ટ થાઓ.',
    onboarding_3_title: 'સાથે મળીને વિકાસ કરીએ',
    onboarding_3_subtitle: 'દેશભરમાં હજારો ખેડૂતોના સમુદાયમાં જોડાઓ અને તમારી ઉપજમાં વધારો કરો.',
  },
  kn: {
    welcome: 'ಮತ್ತೆ ಸ್ವಾಗತ',
    language: 'ಕನ್ನಡ',
    select_language: 'ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ',
    continue: 'ಮುಂದುವರಿಸಿ',
    onboarding_1_title: 'ನಮ್ಮ ಭೂಮಿಯನ್ನು ರಕ್ಷಿಸಿ',
    onboarding_1_subtitle: 'ಭೂಮಿಯನ್ನು ನೈಜ ಜೀವನದ ನಕ್ಷೆಯಾಗಿ ಮಾಡಿ. ಅದು ಸರಿಯಾದ ಕೈಗಳಲ್ಲಿದ್ದರೆ ಮತ್ತು ಗಾಳಿ ಹಾಗೂ ಕಾರ್ಖಾನೆಯ ಮಾಲಿನ್ಯದಿಂದ ಮುಕ್ತವಾಗಿದ್ದರೆ ಜೀವನವು ಉತ್ತಮವಾಗಿರಬಹುದು.',
    onboarding_2_title: 'ಆಧುನಿಕ ಕೃಷಿ',
    onboarding_2_subtitle: 'ಆಧುನಿಕ ರೈತರಿಗೆ ಉತ್ತಮ ಮಾರ್ಗವನ್ನು ಅನ್ವೇಷಿಸಿ. ಮಾರುಕಟ್ಟೆಗಳು ಮತ್ತು ಹವಾಮಾನದೊಂದಿಗೆ ನೈಜ-ಸಮಯದಲ್ಲಿ ಸಂಪರ್ಕ ಸಾಧಿಸಿ.',
    onboarding_3_title: 'ಒಟ್ಟಿಗೆ ಬೆಳೆಯೋಣ',
    onboarding_3_subtitle: 'ದೇಶದಾದ್ಯಂತ ಇರುವ ಸಾವಿರಾರು ರೈತರ ಸಮುದಾಯಕ್ಕೆ ಸೇರಿ ಮತ್ತು ನಿಮ್ಮ ಇಳುವರಿಯನ್ನು ಹೆಚ್ಚಿಸಿ.',
  },
  pa: {
    welcome: 'ਜੀ ਆਇਆਂ ਨੂੰ',
    language: 'ਪੰਜਾਬੀ',
    select_language: 'ਭਾਸ਼ਾ ਚੁਣੋ',
    continue: 'ਜਾਰੀ ਰੱਖੋ',
    onboarding_1_title: 'ਸਾਡੀ ਧਰਤੀ ਦੀ ਰੱਖਿਆ ਕਰੋ',
    onboarding_1_subtitle: 'ਧਰਤੀ ਨੂੰ ਅਸਲ ਜੀਵਨ ਦਾ ਨਕਸ਼ਾ ਬਣਾਓ। ਜੇ ਇਹ ਸਹੀ ਹੱਥਾਂ ਵਿੱਚ ਹੋਵੇ ਅਤੇ ਹਵਾ ਅਤੇ ਫੈਕਟਰੀ ਪ੍ਰਦੂਸ਼ਣ ਤੋਂ ਮੁਕਤ ਹੋਵੇ ਤਾਂ ਜੀਵਨ ਬਿਹਤਰ ਹੋ ਸਕਦਾ ਹੈ।',
    onboarding_2_title: 'ਆਧੁਨਿਕ ਖੇਤੀ',
    onboarding_2_subtitle: 'ਆਧੁਨਿਕ ਕਿਸਾਨ ਲਈ ਇੱਕ ਬਿਹਤਰ ਤਰੀਕਾ ਖੋਜੋ। ਬਾਜ਼ਾਰਾਂ ਅਤੇ ਮੌਸਮ ਨਾਲ ਅਸਲ-ਸਮੇਂ ਵਿੱਚ ਜੁੜੋ।',
    onboarding_3_title: 'ਇਕੱਠੇ ਵਿਕਾਸ ਕਰੀਏ',
    onboarding_3_subtitle: 'ਦੇਸ਼ ਭਰ ਵਿੱਚ ਹਜ਼ਾਰਾਂ ਕਿਸਾਨਾਂ ਦੇ ਭਾਈਚਾਰੇ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਵੋ ਅਤੇ ਆਪਣੀ ਪੈਦਾਵਾਰ ਵਧਾਓ.',
  },
  ks: {
    welcome: 'ولیو واپس',
    language: 'کٲشُر',
    select_language: 'زبان کرِو منتحب',
    continue: 'جٲری تھٲوِو',
    onboarding_1_title: 'پننہِ زمیٖنٕچ حِفاظت کٔرِو',
    onboarding_1_subtitle: 'زمیٖن بناوِو اصلی زِندگی ہُنٛد نقشہٕ۔ یِلہِ یِہ صحیٖح اتھن منٛز آسہِ تہٕ ہوہچہِ تہٕ کارخانٕچ گندگی نِش پاک آسہِ تہٕ زِندگی ہیکہِ اصل گٔژھِتھ۔',
    onboarding_2_title: 'جدیٖد کٲشکاری',
    onboarding_2_subtitle: 'جدیٖد کِسانَس خٲطرٕ اکھ بَہتَر طریٖقہٕ پرٛژھِو۔ مارکیٹَن تہٕ موسمَس سۭتہِ وۄنکیٚنَس جُڑِو۔',
    onboarding_3_title: 'اِکَوَٹہٕ بَڑِو',
    onboarding_3_subtitle: 'سأرسٕے مُلکس منٛز ساسہٕ بٔدِ کِسانَن ہِنٛدِس جَماعتَس سۭتہِ شٲمِل گٔژھِو تہٕ پَنٕنہِ پٲداوار بَڈٲوِو۔',
  }
};

const i18n = new I18n(translations);

// Set the locale once at the beginning of your app.
i18n.locale = Localization.getLocales()?.[0]?.languageCode ?? 'en';

// When a value is missing from a language it'll fallback to another language with the key present.
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

export default i18n;
