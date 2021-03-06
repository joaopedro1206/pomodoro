import React, {useState, useEffect} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  Platform,
  Vibration
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {CommonActions} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import IonIcon from 'react-native-vector-icons/Ionicons';
import BackgroundTimer from 'react-native-background-timer';
import Sound from 'react-native-sound';
Sound.setCategory('Playback')
import VIForegroundService from '@voximplant/react-native-foreground-service';
import { useDispatch } from "react-redux";
import AsyncStorage from '@react-native-community/async-storage';
import { UPDATE_POMODORO_STATUS } from '../../actions/actionTypes';

enum Status {
  pomodoroRound = 'pomodoroRound',
  smallBreak = 'smallBreak',
  longBreak = 'longBreak',
}

const inicialMinutes = 0;
const initialSeconds = 10;

export const PomodoroPage: React.FC = ({navigation}) => {
  const dispatch = useDispatch();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [interval, setStateInterval] = useState(null);
  const [status, setStatus] = useState(Status.pomodoroRound);
  const [round, setRound] = useState(1);
  const [soundPause, setSoundPause] = useState(null);
  const [soundWork, setSoundWork] = useState(null);
  const [focusTime, setFocusTime] = useState(0);
  const [shortBreakTime, setShortBreakTime] = useState(0);
  const [longBreakTime, setLongBreakTime] = useState(0);

  const routeNames = [
    "Todo",
    "Pomodoro",
    "Notes"
  ];

  const ONE_SECOND_IN_MS = 1000;

  const PATTERN = [
    0,
    1 * ONE_SECOND_IN_MS
  ];

  const PATTERN_DESC =
    Platform.OS === "android"
      ? "wait 1s, vibrate 2s, wait 3s"
      : "wait 1s, vibrate, wait 2s, vibrate, wait 3s";

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      getSettings()
    });

    return unsubscribe;
  }, [navigation])

  useEffect(() => {
    const callback = (error, sound, type) => {
      if (error) {
        Alert.alert('error', error.message);
        return;
      }
      // sound.play();
      if (type === 'work') setSoundWork(sound);
      else setSoundPause(sound);
    };

    const sound1 = new Sound(require('./long-chime-sound.mp3'), (error) =>
      callback(error, sound1, 'pause'),
    );
    const sound2 = new Sound(require('./ding_ding_ding.mp3'), (error) =>
      callback(error, sound2, 'work'),
    );

    initConfig()

    // getSettings()
  }, []);

  const initConfig = async () => {
    console.log('init config ******')
    await AsyncStorage.setItem('isPlaying', String(false))
    await AsyncStorage.setItem('isPaused', String(false))
  }

  const getSettings = async () => {
    let settings = await AsyncStorage.getItem('settings');
    settings = JSON.parse(settings);
    setFocusTime(settings ? settings.focusLength : 25)
    setShortBreakTime(settings? settings.shortBreakLength : 5)
    setLongBreakTime(settings ? settings.longBreakLength : 25)

    const isPlayingStorage = await AsyncStorage.getItem('isPlaying')
    const isPausedStore = await AsyncStorage.getItem('isPaused')

    if(isPlayingStorage !== 'true' && isPausedStore !== 'true') setMinutes(settings ? settings.focusLength : 25)
    // setMinutes(0)
    // setSeconds(5)
  }

  const startService = async (stateMinutes, stateSeconds, statusParam) => {
    if (Platform.OS !== 'android') {
      return;
    }

    if (Platform.Version >= 26) {
      const channelConfig = {
        id: 'ForegroundServiceChannel',
        name: 'Notification Channel',
        description: 'Notification Channel for Foreground Service',
        enableVibration: false,
        importance: 3,
      };
      await VIForegroundService.createNotificationChannel(channelConfig);
    }
    const notificationConfig = {
      id: 3456,
      title: `${getMessageText(statusParam)} ${formatTime(stateMinutes)}:${formatTime(stateSeconds)}`,
      text: '',
      icon: 'ic_notification',
      priority: 0,
    };
    if (Platform.Version >= 26) {
      notificationConfig.channelId = 'ForegroundServiceChannel';
    }
    await VIForegroundService.startService(notificationConfig);
  };

  const stopService = async () => {
    if(Platform.OS === 'android') await VIForegroundService.stopService();
  };

  const startCountDown = (
    stateMinutes: number,
    stateSeconds: number,
    statusParam = Status.pomodoroRound,
    roundParam = round,
  ) => {
    setStatus(statusParam);
    setRound(roundParam);
    setPlay(true);
    setPause(false);
    if (Platform.OS === 'ios') {
      BackgroundTimer.start();
    }

    let createInterval = BackgroundTimer.setInterval(() => {
      startService(stateMinutes, stateSeconds, statusParam);
      console.log(`interval: ${stateMinutes}:${stateSeconds}`)
      if (stateSeconds === 0) {
        if (stateMinutes === 0) {
          playSound(statusParam);

          BackgroundTimer.clearInterval(createInterval);
          nextRound(statusParam, roundParam);
        } else {
          stateSeconds = 59;
          stateMinutes--;
          setSeconds(stateSeconds);
          setMinutes(stateMinutes);
        }
      } else {
        stateSeconds--;
        setSeconds(stateSeconds);
      }
    }, 1000);
    setStateInterval(createInterval as any);
  };

  const playSound = (statusParam: string) => {
    Vibration.vibrate(PATTERN)
    if (statusParam === Status.pomodoroRound) soundPause.play();
    else soundWork.play();
  };
  const nextRound = (statusParam: string, roundParam: number) => {
    dispatch({
      type: UPDATE_POMODORO_STATUS,
      status: statusParam
    })

    if (statusParam === Status.pomodoroRound) {
      roundParam === 4 ? setLongBreak(roundParam) : setSmallBreak(roundParam);
    } else if (statusParam === Status.smallBreak) {
      setPomodoroRound(roundParam);
    } else if (statusParam === Status.longBreak) {
      setPomodoroRound(1);
    }
  };

  const setTabColor = (statusParam: string) => {
    navigation.dispatch((state) => {
      console.log(routeNames[state.index])
      return CommonActions.navigate({
        name: routeNames[state.index],
        params: {statusParam},
      })
    });
  };

  const setLongBreak = (roundParam: number) => {
    startCountDown(longBreakTime, 0, Status.longBreak, roundParam);
    setTabColor('break');
  };

  const setSmallBreak = (roundParam: number) => {
    startCountDown(shortBreakTime, 0, Status.smallBreak, roundParam + 1);
    setTabColor('break');
  };

  const setPomodoroRound = (roundParam: number) => {
    startCountDown(focusTime, 0, Status.pomodoroRound, roundParam);
    setTabColor('pomodoro');
  };

  const pause = () => {
    setPause(true);
    setPlay(false);
    BackgroundTimer.clearInterval(interval as any);
  };

  const reiniciar = () => {
    BackgroundTimer.clearInterval(interval as any);
    setStatus(Status.pomodoroRound);
    setPause(false);
    setPlay(false);
    setRound(1);
    setMinutes(focusTime);
    setSeconds(0);
    setTabColor('pomodoro');
    stopService();

    dispatch({
      type: UPDATE_POMODORO_STATUS,
      status: ''
    })
  };

  const setPlay = async (play: boolean) => {
    await AsyncStorage.setItem('isPlaying', String(play))
    setIsPlaying(play)
  }

  const setPause = async (pause: boolean) => {
    await AsyncStorage.setItem('isPaused', String(pause))
    setIsPaused(pause)
  }

  const generateActionButtons = () => {
    if (isPlaying) {
      return (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            pause();
          }}>
            <IonIcon
              name="pause"
              size={25}
              color="white"
            />
        </TouchableOpacity>
      );
    }
    if (isPaused) {
      return (
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => startCountDown(minutes, seconds, status)}>
            <IonIcon
              name="play"
              size={25}
              color="white"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => reiniciar()}>
            <IonIcon
              name="stop"
              size={25}
              color="white"
            />
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => startCountDown(minutes, seconds)}>
          <IonIcon
            name="play"
            size={25}
            color="white"
          />
        {/* <Text style={styles.buttonText}>Iniciar</Text> */}
      </TouchableOpacity>
    );
  };

  const formatTime = (time: number) => {
    if (time < 10) {
      let stringFormat = time.toString();
      return '0' + stringFormat;
    }
    return time;
  };

  const getMessage = () => {
    switch (status) {
      case Status.pomodoroRound:
        return <Text style={styles.messageText}>Foco!</Text>;
      case Status.smallBreak:
        return <Text style={styles.messageText}>Respire!</Text>;
      case Status.longBreak:
        return <Text style={styles.messageText}>Pausa Longa!</Text>;
      default:
        break;
    }
  };

  const getMessageText = (statusParam) => {
    switch (statusParam) {
      case Status.pomodoroRound:
        return 'Foco';
      case Status.smallBreak:
        return 'Respire';
      case Status.longBreak:
        return 'Pausa Longa';
      default:
        break;
    }
  };

  const goToSettings = () => {
    navigation.navigate('Settings');
  };

  const skip = () => {
    Alert.alert('Deseja realmente pular etapa?', '', [
      {
        text: 'Não',
        style: "cancel"
      },
      {
        text: 'Sim',
        onPress: () => {
          BackgroundTimer.clearInterval(interval);
          nextRound(status, round);
        },
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.pomodoroGroup}>
        <LinearGradient
          style={styles.containerPost}
          start={{x: 0, y: 1}}
          end={{x: 0, y: 0}}
          colors={
            status === Status.pomodoroRound
              ? ['#E33B3F', '#E33B3F']
              : ['#17b7dd', '#17b7dd']
          }>
          <View
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              padding: 20,
            }}>
            <TouchableOpacity onPress={() => goToSettings()} style={{}}>
              <Icon
                name="settings"
                size={30}
                color="white"
                onPress={() => goToSettings()}
                style={{padding: 20}}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => skip()}
              style={{width: 60, height: 50}}>
              <Text style={styles.skipText}>Pular</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.pomodoro}>
            <View>
              <Text style={styles.countDown}>
                {formatTime(minutes)}:{formatTime(seconds)}
              </Text>
            </View>
            <View style={styles.divider} />
            {generateActionButtons()}
            <View style={styles.divider} />
            {getMessage()}
          </View>
        </LinearGradient>
      </View>
      <View style={styles.goalGroup}>
        <View>
          <Text
            style={{
              color: '#777',
              fontFamily: 'Rajdhani-Medium',
              fontSize: 16,
            }}>
            ROUND
          </Text>
        </View>
        <View style={styles.goal}>
          <Text
            style={{
              color: '#777',
              fontFamily: 'Rajdhani-SemiBold',
              fontSize: 30,
            }}>
            {round}
          </Text>
          <Text
            style={{
              color: '#777',
              fontFamily: 'Rajdhani-Medium',
              fontSize: 16,
            }}>
            / 4
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
  },
  pomodoroGroup: {
    flex: 5,
  },
  pomodoro: {
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: 'white',
    // backgroundColor: 'green',
    flex: 1,
  },
  headerPomodoro: {},
  headerPular: {},
  goalGroup: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerPost: {
    width: '100%',
    height: '100%',
  },
  goal: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    height: 30,
  },
  countDown: {
    color: 'white',
    fontFamily: 'Rajdhani-Light',
    fontSize: 100,
    marginTop: 20,
  },
  buttonGroup: {
    flexDirection: 'row',
  },
  actionButton: {
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: 'white',
    borderWidth: 1,
    height: 70,
    width: 70,
    borderRadius: 50,
    // backgroundColor: 'white'
  },
  buttonText: {
    color: 'white',
    fontFamily: 'Rajdhani-Light',
  },
  skipText: {
    color: 'white',
    fontFamily: 'Rajdhani-Medium',
    marginTop: 30,
  },
  messageText: {
    color: 'white',
    fontFamily: 'Rajdhani-Regular',
    fontSize: 30,
  },
});
