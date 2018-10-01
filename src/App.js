import React, {Component} from 'react';
// import logo from './logo.svg';
import './App.css';
import {execOpcode} from './opcodes';
import {invaders, blinky, pong, chip8_fontset} from './games/pong';

// this will include all the panels, the debugging and the whole page...
class Emulator extends Component {
  constructor() {
    super();
    this.state = {
      lastOpcode: '',
      prettyOpcode: '',
      memory: [],
      lastPC: '', // program counter (for debugging)
      lastStateUpdated: [], // so we can keep track of what state is being changed
      // to speed things up
      hideDebuggingTools: true,
    };

    this.setGlobalState = this.setGlobalState.bind(this);

    // global obj we pass down so child can attach fns that parent can call...
    // FIXME: Feels dirty... Would redux or similar help here?
    // FIXME: should CPU cycle be moved up here? Maybe it should...
    // Get it working first, then we can always clean it up...
    this.global = {
      emState: {},
      notifyStatePropUpdate: this.notifyStatePropUpdate.bind(this),
    };
  }
  // FIXME: this is WAY WAY WAY too complex... :|
  notifyStatePropUpdate(item) {
    this.setState({
      // create new array and spread old one on top of it...
      lastStateUpdated: [...this.state.lastStateUpdated, item],
    });
  }

  setGlobalState(newState) {
    this.setState(newState);
  }

  render() {
    if (this.state.hideDebuggingTools) {
      return (
        <div className="App">
          <Game global={this.global} setGlobalState={this.setGlobalState} />
        </div>
      );
    }

    return (
      <div className="App">
        <Game global={this.global} setGlobalState={this.setGlobalState} />

        <div className="timescrubber-container">
          <TimeScrubber
            global={this.global}
            prettyOpcode={this.state.prettyOpcode}
            lastOpcode={this.state.lastOpcode}
          />
        </div>

        <div className="memory-access-container">
          <MemoryAccess memory={this.state.memory} pc={this.state.lastPC} />
        </div>

        <div className="emu-state-container">
          <EmuState
            emState={this.global.emState}
            lastUpdated={this.state.lastStateUpdated}
            updatedBy={this.state.lastOpcode}
          />
        </div>
      </div>
    );
  }
}

class Game extends Component {
  constructor(props) {
    super(props);
    // FIXME: is this really emlator state? Consider moving this up a level...
    // Consider moving memory into state...
    // FIXME: Consider moving this out of state, because we don't want to redraw
    // the UI every time this is updated...
    // And that allows us to not worry about it being setState...
    // then we can also observe which one has been updated... just pass our own manual setState fn...
    // FIXME: just keep mutating state the way we are... for now...
    var emState = {
      V: new Array(0xf).fill(0), // 16 length array. Zero filled
      I: 0,
      pc: 0x200, // Program counter starts at 0x200 (512) in memory
      screen: new Array(64 * 32).fill(0), // 2048 items
      // screen: new Array(32).fill(new Array(64).fill(0)), // 2048 items
      stack: [],
      sp: 0,
      keys: new Array(16).fill(0), // 16 length. 0 means off (hasn't been pressed)

      delayTimer: 0, // will decrement at a rate of 60hz
      soundTimer: 0, // system buzzer sounds whenever timer reaches zero

      // FIXME: add this to emulator? Or should it be here?
      // Should I draw to the screen? Basically shouldScreenUpdate
      drawFlag: false,
      isPaused: false, // for game, but also for debugging

      // for debugging only...
      prettyOpcode: '',
    };

    // FIXME: move to emulator?
    var memory = [];

    // For debugging, allow us to notify state changes in UI
    var handler = {
      get(target, key) {
        // console.info(`Get on property "${key}"`);
        return target[key];
      },
      set(target, key, value) {
        // console.info(`Set on property "${key}"`);

        // notify parent if prettyOpCode is updated
        if (key === 'prettyOpcode') {
          // props.setGlobalState({prettyOpcode: value});
        }

        if (key != 'prettyOpcode' && key != 'pc') {
          // last state updated. NOT prettyOpcode
          // props.global.notifyStatePropUpdate(key);
        }

        target[key] = value;
        return true;
      },
    };

    var memHandler = {
      set(target, key, value) {
        console.info(`Set on MEMORY i: "${key}: ${value}"`);

        target[key] = value;
        // notify parent if prettyOpCode is updated
        // props.setGlobalState({memory: target});

        return true;
      },
    };

    // point the local (non-proxy) emstate object at the global one
    // this way we point at the same reference globally, and that access
    // isn't observed. FIXME: move the state up already. This is so gross...
    props.global.emState = emState;

    this.emState = new Proxy(emState, handler);
    this.memory = new Proxy(memory, memHandler);

    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.resetKeys = this.resetKeys.bind(this);

    // for debugging, allow parent to run loop once
    this.playOneFrame = this.playOneFrame.bind(this);
    props.global.playOneFrame = this.playOneFrame;
  }

  // reset keys so we they don't stick!
  // FIXME: this will be a little buggy. We shouldn't reset all the keys
  resetKeys() {
    this.emState.keys = new Array(16).fill(0); // 16 length. 0 means off (hasn't been pressed)
  }

  // listen for 15 keys
  handleKeyPress(e) {
    var keyPressed = e.key;
    // debugger;
    // prettier-ignore
    var keyMap= [
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'q', 'w', 'e', 'r', 't', 'z'];

    // return;
    //
    var pos = keyMap.indexOf(keyPressed);

    if (pos != -1) {
      this.emState.keys[pos] = 1;
    }
  }

  // set up the game state.
  componentDidMount() {
    // load game
    this.loadGame(); // FIXME: pass in what game
    // start CPU loop
    this.cpuLoop();

    document.addEventListener('keydown', this.handleKeyPress, false);
    document.addEventListener('keyup', this.resetKeys, false);
  }

  playOneFrame() {
    this.cpuLoop();
  }

  loadGame() {
    // for (var i = 0; i < 80; i++) {
    for (var i = 0; i < chip8_fontset.length; i++) {
      this.memory[i] = chip8_fontset[i];
    }

    // After you have initialized the emulator, load the program into the memory
    // (use fopen in binary mode) and start filling the memory at location: 0x200 == 512.
    for (var i = 0; i < pong.length; ++i) {
      this.memory[i + 512] = pong[i];
    }

    // this.props.setGlobalState({memory: this.memory});
  }

  // FIXME: use setState instead...
  cpuLoop() {
    var opcode =
      (this.memory[this.emState.pc] << 8) | this.memory[this.emState.pc + 1];

    // this.props.setGlobalState({
    //   lastPC: this.emState.pc,
    //   lastOpcode: opcode.toString(16),
    // });
    execOpcode(opcode, this.emState, this.setState.bind(this), this.memory);

    // Update timers
    if (this.emState.delayTimer > 0) {
      // this.setState({delayTimer: this.state.delayTimer - 1});
      --this.emState.delayTimer;
    }

    if (this.emState.soundTimer > 0) {
      if (this.state.soundTimer === 1) {
        console.log('BEEP!\n');
      }

      // this.setState({soundTimer: this.state.soundTimer - 1});
      --this.emState.soundTimer;
    }

    // FIXME: delay until setstate has happened?
    // FIXME: or just force this to be async...?
    // this allows setState() etc to happeng...
    // FIXME: simplify this logic...
    if (this.emState.isPaused) return;

    if (this.emState.drawFlag) {
      // FIXME: change this value
      this.emState.drawFlag = false;

      // window.requestAnimationFrame(this.cpuLoop.bind(this));

      setTimeout(() => {
        this.setState({drawFlag: false}, () => {
          this.cpuLoop();
        });
      }, 0);
    } else {
      // setTimeout(() => {
      // slower with RAF than without
      // window.requestAnimationFrame(this.cpuLoop.bind(this));
      this.cpuLoop();
      // }, 0);
    }
  }

  render() {
    return (
      <GameCanvas
        onKeyDown={this.handleKeyPress}
        screen={this.emState.screen}
      />
    );
  }
}

class GameCanvas extends Component {
  // constructor() {
  // super();
  // this.state = {
  // screen: new Array(64 * 32).fill(0), //2048 items
  // };
  // }
  render() {
    // var screen = [];

    var screen = this.props.screen.map(pixel => {
      var className = pixel === 0 ? 'pixel' : 'pixel active';
      return <div className={className} />;
    });

    // for (var i = 0; i < this.props.screen.length; i++) {
    //   var rowPixels = this.props.screen[i];
    //
    //   rowPixels.forEach((pixel, x) => {
    //     debugger;
    //     var className = pixel === 0 ? 'pixel' : 'pixel active';
    //     screen.push(
    //       <div
    //         id={i.toString() + x}
    //         key={i.toString() + x}
    //         className={className}
    //       />,
    //     );
    //   });
    // }

    return <div className="canvas-container">{screen}</div>;
  }
}

// components for other parts of the page
// scrubber, codesurfer
//
//
class TimeScrubber extends Component {
  constructor() {
    super();
    // TODO: make these props?
    this.state = {
      lastOpcode: '',
      prettyCode: '',
    };
  }
  render() {
    var {global, lastOpcode, prettyOpcode} = this.props;
    var legend = `
LD - Load instruction into a register
DRW - DRAW Vx, Vy, nibble. Fill state.screen[]. Set state.drawFlag.
CALL - CALL subroutine at nnn (2nnn).
RET - Return from a subroutine.
      `;
    return (
      <div>
        {lastOpcode}
        <br />
        {prettyOpcode}
        <br />

        <pre>{legend}</pre>
        <br />
        <button onClick={global.playOneFrame}>Play one frame</button>
      </div>
    );
  }
}

class MemoryAccess extends Component {
  constructor() {
    super();
    this.state = {
      hideNull: true,
    };
  }
  render() {
    // last program counter. Curren one in state will be the pc for the next instruction...
    var {pc} = this.props;
    var mem = [];

    for (var i = 0; i < this.props.memory.length; i++) {
      var hex;
      var item = this.props.memory[i];

      if (typeof item === 'undefined') {
        hex = 'null';
      } else {
        hex = item.toString(16).padStart(2, '0');
      }

      // gross. Improve this?!?
      if ((this.state.hideNull && hex === 'null') || i < 512) {
        // Removes everything that 's null and non-grogram code before 0x200 (512)
      } else {
        if (pc === i || pc + 1 === i) {
          mem.push(<span className="mem-active">{hex},</span>);
        } else {
          mem.push(<span>{hex},</span>);
        }
      }
    }

    // var mem = this.props.memory.map((item, i) => {
    //   if (!item) {
    //     console.log('item null', i);
    //   }
    //   // turn into hex, and zero-pad
    //   return <span>{item.toString(16).padStart(2, '0')},</span>;
    // });

    return (
      <div>
        <b>memoryAccess</b>: <b>{pc}</b>
        <br />
        <div className="memory-access-digits">{mem}</div>
      </div>
    );
  }
}

class EmuState extends Component {
  render() {
    var {emState, updatedBy, lastUpdated} = this.props;
    // ponyfill a few so it isn't too long (like screen)
    //
    console.log('emState', emState);
    var stateCopy = Object.assign({}, emState, {screen: []});
    delete stateCopy.prettyOpcode;
    var state = JSON.stringify(stateCopy);

    var output = [];
    for (var key in stateCopy) {
      output.push(<span>{key}:</span>);

      // if (lastUpdated.includes(key)) {
      //   output.push(
      //     <span className="active">{JSON.stringify(stateCopy[key])}</span>,
      //   );
      // } else {
      output.push(<span>{JSON.stringify(stateCopy[key])}</span>);
      // }
    }

    return (
      <div>
        <b>EmuState</b>: <br />
        <div className="emu-state-output">{output}</div>
      </div>
    );
  }
}

export default Emulator;

// class App extends Component {
//   render() {
//     return (
//       <div className="App">
//         <GameCanvas />
//         <header className="App-header">
//           <img src={logo} className="App-logo" alt="logo" />
//           <h1 className="App-title">Welcome to React</h1>
//         </header>
//         <p className="App-intro">
//           To get started, edit <code>src/App.js</code> and save to reload.
//         </p>
//       </div>
//     );
//   }
// }
