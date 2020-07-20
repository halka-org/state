import {
  useRef,
  useState,
  useEffect,
  useCallback,
  EffectCallback,
  DependencyList,
} from 'react';

function useMountEffect(effect: EffectCallback) {
  useEffect(effect, []);
}

function useIsJustMountedState(): boolean {
  const isJustMounted = useRef(true);

  if (isJustMounted.current) {
    isJustMounted.current = false;

    return true;
  }

  return isJustMounted.current;
}

function useUpdateOnlyEffect(
  effect: EffectCallback,
  dependencies?: DependencyList
) {
  const isJustMounted = useIsJustMountedState();

  useEffect(() => {
    if (!isJustMounted) {
      return effect();
    }
  }, dependencies);
}

function useForceUpdate() {
  const triggerUpdate = useState(false)[1];

  return useCallback(() => {
    triggerUpdate((val) => !val);
  }, []);
}

// typescript has issues with unique symbol type for Set and Record
// this is a work around
const uniqueSymbol: unique symbol = Symbol('_');
type UniqueSymbol = typeof uniqueSymbol;

type Selector<State> = (state: State) => Partial<State>;
type EqualityCheck<State> = (
  prevSlice: Partial<State>,
  nextSlice: Partial<State>
) => boolean;
interface Listener<State> {
  triggerUpdate: ReturnType<typeof useForceUpdate>;
  prevSlice: Partial<State>;
  selector: Selector<State>;
  equalityCheck: EqualityCheck<State>;
}
type Listeners<State> = Record<UniqueSymbol, Listener<State>>;

export function createStore<State>(initialState: State) {
  const listenerKeys = new Set<UniqueSymbol>();
  let listeners: Listeners<State> = {} as Listeners<State>;

  const store = {
    state: initialState,
    getState(): State {
      return this.state;
    },
  };

  function updater(arg: State): void;
  function updater(arg: (prevState: State) => State): void;
  function updater(arg: any): void {
    let newState = arg as State;
    if (typeof arg === 'function') {
      newState = arg(store.state) as State;
    }

    store.state = newState;

    listenerKeys.forEach((key: UniqueSymbol) => {
      const listener = listeners[key];

      const nextSlice = listener.selector(store.state);

      if (!listener.equalityCheck(listener.prevSlice, nextSlice)) {
        listener.triggerUpdate();
      }
    });
  }

  const defaultSelector: Selector<State> = (state) => state;
  const defaultEqualityCheck: EqualityCheck<State> = (prevSlice, nextSlice) =>
    prevSlice === nextSlice;

  const useStore = (
    selector: Selector<State> = defaultSelector,
    equalityCheck: EqualityCheck<State> = defaultEqualityCheck
  ): [Partial<State>, typeof updater] => {
    const state = store.getState();

    const listenerKeyRef = useRef(Symbol('listener'));

    const triggerUpdate = useForceUpdate();

    useMountEffect(() => {
      const listenerKey = listenerKeyRef.current;
      listenerKeys.add(listenerKey as UniqueSymbol);
      listeners[listenerKey] = {
        triggerUpdate,
        prevSlice: selector(state),
        selector,
        equalityCheck,
      };

      return () => {
        listenerKeys.delete(listenerKey as UniqueSymbol);
        delete listeners[listenerKey];
      };
    });

    useUpdateOnlyEffect(() => {
      const listenerKey = listenerKeyRef.current;
      listeners[listenerKey].selector = selector;
    }, [selector]);

    useUpdateOnlyEffect(() => {
      const listenerKey = listenerKeyRef.current;
      listeners[listenerKey].equalityCheck = equalityCheck;
    }, [equalityCheck]);

    useUpdateOnlyEffect(() => {
      const listenerKey = listenerKeyRef.current;
      listeners[listenerKey].prevSlice = selector(state);
    });

    return [selector(state), updater];
  };

  return [useStore, updater, store.getState];
}
