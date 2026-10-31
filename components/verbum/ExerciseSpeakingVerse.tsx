import { gradeSpeaking, type SpokenWord } from '@/lib/verbum/speaking';
import { playCorrectChime, playWrongTone } from '@/lib/verbum/sound';
import { speakVerse } from '@/lib/verbum/api';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';

type RecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type BrowserRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type Props = {
  phrase: string;
  onPass: (transcript: string) => void;
  onMiss: () => void;
};

function recognitionConstructor(): (new () => BrowserRecognition) | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const host = window as Window & {
    SpeechRecognition?: new () => BrowserRecognition;
    webkitSpeechRecognition?: new () => BrowserRecognition;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

function readTranscript(event: RecognitionEvent): string {
  const parts: string[] = [];
  for (let index = 0; index < event.results.length; index += 1) {
    parts.push(event.results[index][0]?.transcript ?? '');
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function ExerciseSpeakingVerse({ phrase, onPass, onMiss }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;
  const heardRef = useRef('');
  const carriedRef = useRef('');
  const listeningRef = useRef(false);
  const startedAtRef = useRef(0);
  const gradedRef = useRef(false);
  const recognitionRef = useRef<BrowserRecognition | null>(null);
  const onPassRef = useRef(onPass);
  const onMissRef = useRef(onMiss);
  const [recording, setRecording] = useState(false);
  const [words, setWords] = useState<SpokenWord[]>(() => gradeSpeaking(phrase, '').words.map((word) => ({ ...word, status: 'pending' })));
  const [notice, setNotice] = useState<string | null>(null);
  const supported = recognitionConstructor() != null;
  onPassRef.current = onPass;
  onMissRef.current = onMiss;

  useEffect(() => {
    setWords(gradeSpeaking(phrase, '').words.map((word) => ({ ...word, status: 'pending' })));
  }, [phrase]);

  useEffect(() => {
    if (!recording) {
      pulse.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 450, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 450, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, recording]);

  useEffect(() => () => {
    listeningRef.current = false;
    gradedRef.current = true;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
  }, []);

  const finish = (transcript: string, failedToHear: boolean) => {
    const grade = gradeSpeaking(phrase, transcript);
    setWords(grade.words.map((word) => (
      failedToHear ? { ...word, status: 'miss' } : word
    )));
    if (!failedToHear && grade.passed) {
      playCorrectChime();
      onPassRef.current(transcript);
      return;
    }
    playWrongTone();
    Vibration.vibrate(80);
    onMissRef.current();
  };

  const showHeard = (transcript: string) => {
    const live = gradeSpeaking(phrase, transcript);
    setWords(live.words.map((word) => (word.status === 'hit' ? word : { ...word, status: 'pending' })));
  };

  const gradeOnce = () => {
    if (gradedRef.current) {
      return;
    }
    gradedRef.current = true;
    listeningRef.current = false;
    setRecording(false);
    finish(heardRef.current, heardRef.current.length === 0);
  };

  const openRecognition = (Ctor: new () => BrowserRecognition) => {
    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const piece = readTranscript(event);
      const transcript = [carriedRef.current, piece].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      heardRef.current = transcript;
      showHeard(transcript);
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        listeningRef.current = false;
        gradedRef.current = true;
        setRecording(false);
        setNotice('Permita o microfone para pronunciar o versículo.');
      }
    };
    recognition.onend = () => {
      carriedRef.current = heardRef.current;
      if (!listeningRef.current) {
        recognitionRef.current = null;
        gradeOnce();
        return;
      }
      window.setTimeout(() => {
        if (!listeningRef.current || recognitionRef.current !== recognition) {
          return;
        }
        try {
          recognition.start();
        } catch {
          setNotice('Não foi possível manter o microfone aberto.');
          listeningRef.current = false;
          gradeOnce();
        }
      }, 200);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const toggleMic = () => {
    const Ctor = recognitionConstructor();
    if (!Ctor) {
      setNotice('Este navegador não libera o microfone. Abra a lição no Chrome.');
      return;
    }
    if (listeningRef.current) {
      if (Date.now() - startedAtRef.current < 700) {
        return;
      }
      listeningRef.current = false;
      const recognition = recognitionRef.current;
      if (!recognition) {
        gradeOnce();
        return;
      }
      try {
        recognition.stop();
      } catch {
        gradeOnce();
      }
      return;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    heardRef.current = '';
    carriedRef.current = '';
    gradedRef.current = false;
    listeningRef.current = true;
    startedAtRef.current = Date.now();
    setNotice(null);
    setRecording(true);
    setWords(gradeSpeaking(phrase, '').words.map((word) => ({ ...word, status: 'pending' })));
    window.setTimeout(() => {
      if (!listeningRef.current) {
        return;
      }
      try {
        openRecognition(Ctor);
      } catch {
        listeningRef.current = false;
        gradedRef.current = true;
        setRecording(false);
        setNotice('Não foi possível abrir o microfone.');
      }
    }, 250);
  };

  return (
    <View style={styles.block}>
      <View style={styles.phraseRow}>
        <View style={styles.words}>
          {words.map((word, index) => (
            <Text
              key={`${word.text}-${index}`}
              style={[
                styles.word,
                word.status === 'hit' ? styles.hit : null,
                word.status === 'miss' ? styles.miss : null,
              ]}
            >
              {word.text}
            </Text>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ouvir pronúncia"
          onPress={() => speakVerse(phrase, null)}
          style={styles.speaker}
        >
          <MaterialIcons name="volume-up" size={22} color="#0369A1" />
        </Pressable>
      </View>
      <Animated.View style={[styles.micWrap, { transform: [{ scale: pulse }] }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={recording ? 'Parar gravação' : 'Falar o versículo'}
          onPress={toggleMic}
          style={[styles.mic, recording ? styles.micLive : null]}
        >
          <MaterialIcons name={recording ? 'mic' : 'mic-none'} size={40} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
      <Text style={styles.hint}>
        {recording ? 'Ouvindo… fale e toque de novo para encerrar.' : 'Toque no microfone e leia a frase em voz alta.'}
      </Text>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {!supported ? <Text style={styles.notice}>O microfone da Web Speech API não está disponível neste navegador.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    alignItems: 'center',
    gap: 16,
  },
  phraseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  words: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  word: {
    color: '#1E3A8A',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
  },
  hit: {
    color: '#15803D',
  },
  miss: {
    color: '#B91C1C',
  },
  speaker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2FE',
  },
  micWrap: {
    marginTop: 4,
  },
  mic: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0EA5E9',
    borderWidth: 1,
    borderColor: '#0369A1',
    borderBottomWidth: 8,
  },
  micLive: {
    backgroundColor: '#FB7185',
    borderColor: '#BE123C',
  },
  hint: {
    color: '#3B4F93',
    textAlign: 'center',
    fontWeight: '700',
  },
  notice: {
    color: '#B91C1C',
    textAlign: 'center',
    fontWeight: '700',
  },
});
