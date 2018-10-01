// export execOpcode
// pass in opcode and setState()
// because that's really all this part has to do.
// SUCH A NICE SEAM!!!

// togglePause()
// resetScreen()
// drawScreen()?
// Q: Do we still need the draw flag? Because of how react works?
// Let's keep it for now...

// FIXME: change memory? Add it to state? Or change name to ROM?
export function execOpcode(opcode, state, setState, memory) {
  // var hex = opcode.toString(16);

  // FIXME: is this order right? This worries me...
  var firstRange = opcode & 0xf0ff; // ie: A015, 8028. fe33 -> f033
  var secondRange = opcode & 0xf00f; // ie: 6001, A001. 82e9 -> 8009
  var thirdRange = opcode & 0xf000; // ie: 6000, 7000 etc. this will convert 0x6134 -> 0x6000 (for easier matching). In JS we don't really need this...
  var fourthRange = opcode & 0x00ff; // ie: 00ee, 0015. 12ee -> 00ee
  // capture 0xfe33 TODO: find a better var name

  var first = codes[firstRange];
  var second = codes[secondRange];
  var third = codes[thirdRange];
  var fourth = codes[fourthRange];

  // FIXME: Write something better for this cascade...
  // FIXME: Specificity here could break us, because the specificity could vary here. We have to be careful about the order...
  var prettyName;
  if (third) prettyName = third(opcode, state, setState, memory);
  else if (first) prettyName = first(opcode, state, setState, memory);
  else if (second) prettyName = second(opcode, state, setState, memory);
  else if (fourth) prettyName = fourth(opcode, state, setState, memory);
  else {
    console.log('### Unknown opcode: 0x%s\n', opcode.toString(16));
    debugger;
  }

  // for debugging / visualization purposes
  state.prettyOpcode = prettyName;
}

var codes = {
  0xa000: function(opcode, state, setState) {
    // ANNN: Sets I to the address NNN
    var hexCode = opcode.toString(16); // convert opcode to hex value
    // radix here refers more to source data format than dest... Interesting...
    // var nnn = opcode & 0x0FFF; // same as taking hex value of opcode and losing first byte (first digit)
    var nnn = parseInt(hexCode.slice(1), 16); // drop first hex digit // we are going FROM base16, so it needs to be noted here
    state.I = nnn;

    // SAME AS
    // this.i = opcode & 0xFFF; // this keeps the last 3 hex values
    state.pc += 2;

    return 'LD I';
  },

  0xb000: function(opcode, state, setState) {
    // Jump to address NNN + V0
    var hexCode = opcode.toString(16); // convert opcode to hex value
    var nnn = (hexCode & 0xfff) + state.V[0]; // keep last 3 values from hexcode
    // debugger;

    state.pc = parseInt(nnn, 16);
  },

  0xc000: function(opcode, state, setState) {
    // Cxnn - Set Vx = random byte AND nn.
    // The interpreter generates a random number from 0 to 255, which is then ANDed with the value nn. The results are stored in Vx.
    // See instruction 8xy2 for more information on AND.

    var hexCode = opcode.toString(16); // convert opcode to hex value
    var x = parseInt(hexCode[1], 16);
    var nn = hexCode[2].toString() + hexCode[3];

    var limit = 255;
    // generate random number between 0 and 255
    // var rand = Math.floor(Math.random() * (limit+1));
    // var rand = Math.floor(Math.random() * limit); // why +1?!?
    // state.V[x] = rand & parseInt(nn, 16); // FIXME: Should this be parseInt'd? That changes the value in some cases...
    // state.V[x] = rand & parseInt(nn, 16); // FIXME: Should this be parseInt'd? That changes the value in some cases...

    // FIXME: verify which works better... I think his code is wrong...
    state.V[x] = Math.floor(Math.random() * 0xff) & (opcode & 0xff);

    state.pc += 2;

    return 'RND Vx, byte - Set Vx = random byte AND kk.';
  },

  // Input  (key-press) handling)
  0xe0a1: function(opcode, state, setState) {
    // Skip next instruction if key with the value of Vx is not pressed.
    var hexCode = opcode.toString(16); // convert opcode to hex value
    var x = parseInt(hexCode[1], 16);
    // Checks the keyboard, and if the key corresponding to the value of Vx is currently in the up position, PC is increased by 2.

    var vx = state.V[x];
    // FIXME: Handle this properly...
    if (state.keys[vx] === 0) {
      state.pc += 2;
    }
    // skip next instruction (+4 to get to the instruction after, since the next instruction is at +2)
    state.pc += 2;

    return 'SKNP Vx -  Skip next instruction if key with the value of Vx is not pressed.';
  },

  0xe09e: function(opcode, state, setState) {
    // Skip next instruction if key with the value of Vx is pressed.
    var hexCode = opcode.toString(16); // convert opcode to hex value
    var x = parseInt(hexCode[1], 16);
    // Checks the keyboard, and if the key corresponding to the value of Vx is currently in the up position, PC is increased by 2.

    var vx = state.V[x];
    if (state.keys[vx] === 1) {
      state.pc += 2;
    }
    // skip next instruction (+4 to get to the instruction after, since the next instruction is at +2)
    state.pc += 2;
  },

  // 0x0000: function(opcode, state, setState) {
  // Jump to a machine code routine at nnn.
  // This instruction is only used on the old computers on which Chip-8 was originally implemented. It is ignored by modern interpreters.
  // state.pc += 2;
  // },
  0x1000: function(opcode, state, setState) {
    // JUMP to location nnn.
    // The interpreter sets the program counter to nnn
    var hexCode = opcode.toString(16); // convert opcode to hex value
    var nnn = hexCode[1].toString() + hexCode[2].toString() + hexCode[3];

    // console.log('nnn', nnn)
    state.pc = parseInt(nnn, 16);

    return 'JP addr - Jump to location nnn.';
  },
  0x2000: function(opcode, state, setState) {
    // CALL subroutine at nnn.
    var hexCode = opcode.toString(16); // convert opcode to hex value

    // The interpreter increments the stack pointer, then puts the current PC on the top of the stack. The PC is then set to nnn.
    state.stack[state.sp] = state.pc;
    state.sp++;
    // vs state.stack[state.sp] = state.pc; ?!?

    state.pc = parseInt(hexCode.slice(1), 16); // FIXME: should this be base16? YES, because the source format is Base 16 (hex)
    //vs state.pc = opcode & 0x0FFF;
    return 'CALL';
  },
  0x3000: function(opcode, state, setState) {
    // 3xnn Skip next instruction if Vx = nn.
    // The interpreter compares register Vx to nn, and if they are equal, increments the program counter by 2.
    var hexCode = opcode.toString(16); // convert opcode to hex value
    var x = parseInt(hexCode[1], 16);
    var nn = parseInt(hexCode[2].toString() + hexCode[3], 16);

    if (state.V[x] == nn) {
      // == because sometimes it'll be '00' == 0
      state.pc += 2;
    }

    state.pc += 2;

    return 'SE Vx, byte -  Skip next instruction if Vx = kk.';
  },

  0x4000: function(opcode, state, setState) {
    // 4xnn Skip next instruction if Vx != nn.
    // The interpreter compares register Vx to kk, and if they are not equal, increments the program counter by 2.
    var hexCode = opcode.toString(16); // convert opcode to hex value
    var x = parseInt(hexCode[1], 16);
    var nn = parseInt(hexCode[2].toString() + hexCode[3], 16);

    // since we increment every single one by +2 I'm assuming this skips an additional block
    if (state.V[x] != nn) {
      // == because sometimes it'll be '00' == 0
      state.pc += 2;
    }

    state.pc += 2;

    return 'SNE Vx, byte - Skip next instruction if Vx != kk.';
  },

  0x5000: function(opcode, state, setState) {
    // 5xy0 Skip the following instruction if the value of register VX is equal to the value of register VY
    // debugger;
    var hexCode = opcode.toString(16); // convert opcode to hex value
    var x = parseInt(hexCode[1], 16);
    var y = parseInt(hexCode[2], 16);

    if (state.V[x] === state.V[y]) {
      state.pc += 2;
    }

    state.pc += 2;
  },
  0x6000: function(opcode, state, setState) {
    // 6XNN Store number NN in register VX. Vx = NN
    var hexCode = opcode.toString(16); // convert opcode to hex value
    // FIXME: Would it be easier to just bitshift instead of parsing it back to int here?
    var x = parseInt(hexCode[1], 16); // 0x6411 -> x = 4, nn = 11;
    var nn = hexCode[2].toString() + hexCode[3]; // concat [2] and [3]

    // FIXME: Should V[] registers contain hex strings or the number values? I'm guessing hte number values
    state.V[x] = parseInt(nn, 16);

    state.pc += 2;

    return 'LD Vx';
  },
  0x7000: function(opcode, state, setState) {
    // 7XNN Set Vx = Vx + nn.

    var hexCode = opcode.toString(16); // convert opcode to hex value
    var x = parseInt(hexCode[1], 16); // 0x6411 -> x = 4, nn = 11;

    var val = (opcode & 0xff) + state.V[x];

    // FIXME: does this even matter? Does it make a difference? WHY!?!
    if (val > 255) {
      // debugger;
      val -= 256;
    }

    state.V[x] = val;

    state.pc += 2;
    return 'ADD Vx, byte - Adds the value kk to the value of register Vx, then stores the result in Vx. ';

    var hexCode = opcode.toString(16); // convert opcode to hex value
    var x = parseInt(hexCode[1], 16); // 0x6411 -> x = 4, nn = 11;
    var nn = hexCode[2].toString() + hexCode[3]; // concat [2] and [3]

    // console.log('nn', nn)
    // console.log('V[x]', state.V[x])
    // console.log('***', state.V[x] + parseInt(nn, 16));
    state.V[x] = state.V[x] + parseInt(nn, 16); // FIXME: is base16 correct here? I think so...

    state.pc += 2;
  },

  // Data registers...
  // 8xx* is FOURTH range...
  // 8xyn
  0x8000: function(opcode, state, setState) {
    // 8xyn - Set Vx = Vy. Stores the value of register Vy in register Vx.
    var hexCode = opcode.toString(16); // convert opcode to hex value

    // returns strings
    var x = parseInt(hexCode[1], 16); //
    var y = parseInt(hexCode[2], 16); //
    var n = hexCode[3]; // this one will be a string. Could be `e`, or any number

    // Should this be a switch statment?
    // Store the value of register VY in register VX
    if (n == 0) {
      // == since we're comparing strings, and I don't want to have to parse it
      state.V[x] = state.V[y];
      state.pc += 2;
      return;
    }

    // Set VX to VX OR VY
    if (n == 1) {
      // FIXME: is this right?
      state.V[x] = state.V[x] | state.V[y];
      state.pc += 2;
      return;
    }

    // 8XY2	Set VX to VX AND VY (bitwise AND)
    // console.log('BEFORE state.V[x]', state.V[x])
    if (n == 2) {
      // console.log('n=', 2)
      state.V[x] = state.V[x] & state.V[y];
      state.pc += 2;
      return;
    }

    // 8XY3   Set VX to VX XOR VY (bitwise XOR)
    if (n == 3) {
      state.V[x] = state.V[x] ^ state.V[y];
      state.pc += 2;
      return;
    }

    // 8XY4	Add the value of register VY to register VX
    // Set VF to 01 if a carry occurs
    // Set VF to 00 if a carry does not occur
    if (n == 4) {
      // FIXME: compare both and see which works better. Favor the less magical solution!!!!
      state.V[x] += state.V[y];
      state.V[0xf] = +(state.V[x] > 255);
      if (state.V[x] > 255) {
        state.V[x] -= 256;
      }

      state.pc += 2;
      return;

      // debugger;
      // console.log('n=', 2)
      var val = state.V[x] + state.V[y];
      // if val is greater than 8 bits (greater than 255, because 11111111 === 255)
      // then drop anything but the lowest 8 bits, and set VF to 1 (carry occurs)
      if (val > 255) {
        state.V[0xf] = 1;
        // keep only 8 lowest bits
        state.V[x] = val & 0xff; // FIXME: Verify
      } else {
        state.V[0xf] = 0;
        state.V[x] = val;
      }
      state.pc += 2;
      return;
    }

    // Subtract the value of register VY from register VX
    // Set VF to 00 if a borrow occurs
    // Set VF to 01 if a borrow does not occur

    // Better expl
    // Set Vx = Vx - Vy, set VF = NOT borrow.
    // If Vx > Vy, then VF is set to 1, otherwise 0. Then Vy is subtracted from Vx, and the results stored in Vx.
    if (n == 5) {
      // THEIR version
      // state.V[0xF] = +(state.V[x] > state.V[y]);
      // state.V[x] -= state.V[y];

      // paddles don't work properly without this... WHY is this needed?
      // I assume because this happens automatically in other langs with unsigned ints
      // if (state.V[x] < 0) {
      // debugger;
      //   state.V[x] += 256;
      // }

      // MY version. Appears to finally work...
      // order really matters. I'm unsure why the instructions have wrong order sometimes...
      if (state.V[x] > state.V[y]) {
        state.V[0xf] = 1;
      } else {
        state.V[0xf] = 0;
      }

      state.V[x] = state.V[x] - state.V[y];

      // paddles don't work properly without this... WHY is this needed?
      // I assume because this happens automatically in other langs with unsigned ints
      if (state.V[x] < 0) {
        state.V[x] += 256;
      }

      state.pc += 2;
      return;
    }

    // Store the value of register VY shifted right one bit in register VX
    // Set register VF to the least significant bit prior to the shift
    if (n == 6) {
      state.V[0xf] = state.V[x] & 0x1;
      state.V[x] >>= 1;

      state.pc += 2;
      return;
      // FIXME: verify which works better... There's seems wrong to me :{

      // https://stackoverflow.com/questions/35190260/getting-least-significant-bit-in-javascript
      // FIXME: lsb of what? of VY?
      var lsb = state.V[y] & 1;

      state.V[0xf] = lsb;
      // FIXME: verify that this is correct...
      state.V[x] = state.V[y] >> 1; // shift 1 bit to the right
      state.pc += 2;
      return;
    }

    // Store the value of register VY shifted left one bit in register VX
    // Set register VF to the most significant bit prior to the shift
    if (n == 'e') {
      // FIXME: verify which works better
      state.V[0xf] = +(state.V[x] & 0x80);
      state.V[x] <<= 1;
      // for some strange reason, when it's above 256 we start again at 0
      // I'm not sure why... WHY?
      // Does this have to do with absolute numbers? When you overflow the bounds, do you just start again at 0? so '255 + 2 = 1'?
      if (state.V[x] > 255) {
        state.V[x] -= 256;
      }

      state.pc += 2;
      return;

      // FIXME: msb of what? of VY?
      var msb = state.V[y].toString(2)[0]; // FIXME/HACK: Total guess. Is this the way to get the msb?!?

      state.V[0xf] = msb;
      // FIXME: verify that this is correct...
      state.V[x] = state.V[y] << 1; // shift 1 bit to the left
      state.pc += 2;
      return;
    }

    console.log('NO 8XY n', n);
    // togglePause();
    debugger;

    // console.log('AFTER state.V[x]', state.V[x])
    // debugger;
  },
  0x9000: function(opcode, state, setState) {
    // 9XY0. Skip the following instruction if the value of register VX is not equal to the value of register VY
    var hexCode = opcode.toString(16); // convert opcode to hex value
    var x = parseInt(hexCode[1], 16); // a
    var y = parseInt(hexCode[2], 16); // b
    // var n = parseInt(hexCode[3],16); // 6 // px height

    if (state.V[x] != state.V[y]) {
      state.pc += 2;
    }

    state.pc += 2;
  },

  // FIXME: stuff still missing here...
  0xd000: function(opcode, state, setState, memory) {
    // Dxyn - drawing graphic pixels. ie: 0xdab6
    // Every sprite will be 8 pixels wide, and N pixels tall...
    // debugger;
    state.V[0xf] = 0;
    var hexCode = opcode.toString(16); // convert opcode to hex value
    var x = parseInt(hexCode[1], 16); // a
    var y = parseInt(hexCode[2], 16); // b
    //
    var height = opcode & 0x000f;
    var registerX = state.V[x];
    var registerY = state.V[y];
    var x, y, spr;
    //
    for (y = 0; y < height; y++) {
      spr = memory[state.I + y];
      for (x = 0; x < 8; x++) {
        if ((spr & 0x80) > 0) {
          if (setPixel(registerX + x, registerY + y, state.screen)) {
            state.V[0xf] = 1;
          }
        }
        spr <<= 1;
      }
    }

    state.drawFlag = true;

    state.pc += 2;

    return 'DRW';

    var hexCode = opcode.toString(16); // convert opcode to hex value
    var x = parseInt(hexCode[1], 16); // a
    var y = parseInt(hexCode[2], 16); // b
    var n = parseInt(hexCode[3], 16); // 6 // px height

    // Read n bytes from mem, starting at memory[I].
    var bytesToDraw = [];

    // FIXME: comment this better?
    for (var i = 0; i < n; i++) {
      bytesToDraw.push(memory[state.I + i]);
    }

    // console.log('bytesToDraw', bytesToDraw)
    var Vx = state.V[x]; // x coord
    var Vy = state.V[y]; // y coord

    // console.log('Vx', Vx)
    // console.log('Vy', Vy)

    // Display sprite at (Vx, Vy),
    // FIXME: if we get to the end, we need to wrap to the next row...
    // TODO: Abstract this into a separate function?
    //
    // TODO PICK UP: STA
    // 1) write a fn that converts the hex value to an string of 8 width
    // 2) Add that to the array and flip the bits
    // 3) Try to draw that (basic test to see if it works...)
    // 4) Add collision detection
    //
    // iterate over n rows (height) to draw
    for (var i = 0; i < n; i++) {
      var row = Vy + i; // FIXME: Simplify this logic!!!
      var rows = state.screen;

      // TODO: make this a function
      var spriteBinary = bytesToDraw[i].toString(2);

      // iterate over x coordinate (0 is off, 1 is paint)
      for (var j = 0; j < spriteBinary.length; j++) {
        var rowItem = Vx + j;

        // FIXME: Is this accurate? IF row is too high (off screen), start at 0 again...
        // Q: Should it be the next row?
        if (row > 31) {
          // FIXME: make this a constant
          row = row - 32; // 32 should be 0
        }

        if (rowItem > 63) {
          // FIXME: make this a constant
          rowItem = rowItem - 64; // 64 should be 0
        }

        // FIXME: Should we fix this?
        // if (state.screen[row] && state.screen[row][Vx+j]) {
        // debugger;
        // if(rows.length < row && rows[row].lenght < rowItem) {
        // if (typeof rows[row] != 'undefined') {
        // toggle pixel values using XOR
        var oldValue = rows[row][rowItem];
        var newValue = parseInt(spriteBinary[j], 10);

        // console.log('oldValue', oldValue)
        // collision bit if we're toggling a pixel that has content (1), then set V[f] to 01
        if (oldValue != 0) {
          // debugger;
          state.V[0xf] = 1; // FIXME: Is this right? Should it be 01?
        } else {
          state.V[0xf] = 0; // FIXME: Is this right? Should it be 01?
        }
        // rows[row][rowItem] = parseInt(spriteBinary[j],10)
        // FIXME: DOCUMENT THIS REALLY WELL ****
        // WITH OLD WAY
        rows[row][rowItem] = oldValue ^ newValue;

        // WITH NEW WAY OF HAVING ONLY 1 ARRAY...
        // rows[0][5] = 5
        // rows[10][1] =
        // rows[(row + 1) * 64 + rowItem] = oldValue ^ newValue;
        // }
        // }
      }
      // var xIndex
      // state.screen[row];
    }

    // for (var i=0; i < bytesToDraw.length; i++) {
    // draw the sprite that is 8px wide, for N rows based on the binary values in bytesToDraw()
    // state.screen[Vy][Vx + i] = bytesToDraw[i];

    // TODO: do the first 3 rows and see if it works...
    // dab6 (6 rows, 6px tall, 8px wide... )
    // each memory index refers to 1 row of bytes
    //240 144 144 144 240 32
    // }

    // FIXME / TODO: Add the DRAWING TO SCREEN PART
    state.drawFlag = true;
    // setState({drawFlag: true});
    // TODO: Add the collision bit part...
    //
    // set VF = collision.
    // console.log('DRAW', (240).toString(2))
    //

    state.pc += 2;
  },

  /****************************
   ** Second Ranges
   /**************************/

  0xf007: function(opcode, state, setState) {
    // Fx07. Set Vx = delay timer value.  The value of DT is placed into Vx.
    var hexCode = opcode.toString(16); // convert opcode to hex value
    var x = parseInt(hexCode[1], 16); //

    state.V[x] = state.delayTimer;

    state.pc += 2;

    return 'LD Vx, DT - Set Vx = delay timer value.';
  },
  0xf00a: function(opcode, state, setState) {
    // Fx0A. Wait for keypress. Resume/start CPU Cycle when keypress happens.
    debugger;

    // setState({isPaused: true});
    state.isPaused = true;
  },
  0xf015: function(opcode, state, setState) {
    // Fx15. Set delay timer = Vx.  DT is set equal to the value of Vx.
    var hexCode = opcode.toString(16); // convert opcode to hex value
    var x = parseInt(hexCode[1], 16); //

    state.delayTimer = state.V[x];

    state.pc += 2;

    return 'LD DT, Vx - Set delay timer = Vx.';
  },
  0xf018: function(opcode, state, setState) {
    // Fx18. Set the sound timer to the value of register VX
    var hexCode = opcode.toString(16); // convert opcode to hex value
    var x = parseInt(hexCode[1], 16); //

    // debugger;
    state.soundTimer = state.V[x];

    state.pc += 2;
  },
  0xf01e: function(opcode, state, setState) {
    // Add the value stored in register VX to register I
    var hexCode = opcode.toString(16); // convert opcode to hex value
    var x = parseInt(hexCode[1], 16); //
    // debugger;

    state.I += state.V[x];

    state.pc += 2;

    return 'ADD I, Vx - The values of I and Vx are added, and the results are stored in I.';
  },
  0xf029: function(opcode, state, setState) {
    // FX29 Set I to the memory address of the sprite data corresponding to the hexadecimal digit stored in register VX
    // debugger;
    var hexCode = opcode.toString(16); // convert opcode to hex value
    var x = parseInt(hexCode[1], 16); //
    var vx = state.V[x];
    // set I to the memory Index of where the sprite for that font is
    // every font is 5 rows (5 indexes).
    // 0 is at memory[0-4] 0 * 5
    // 1 is at memory[5-9] 1 * 5
    // 2 is at memory[10-9]
    state.I = vx * 5;

    state.pc += 2;

    return `
    LD F, Vx
    Set I = location of sprite for digit Vx.

The value of I is set to the location for the hexadecimal sprite corresponding to the value of Vx.`;
  },

  0xf033: function(opcode, state, setState, memory) {
    // FX33 Store the binary-coded decimal equivalent of the value from register VX at addresses I, I+1, and I+2
    // The interpreter takes the decimal value of Vx, and places the hundreds digit in memory at location in I, the tens digit at location I+1, and the ones digit at location I+2.
    var hexCode = opcode.toString(16); // convert opcode to hex value
    var x = parseInt(hexCode[1], 16); //

    // debugger;
    // The interpreter takes the decimal value of Vx,
    // var dec = pad(state.V[x], 3, 0); // 0 -> "000", 3 -> "003" pad to 3 digits. 0 if not there. Convert to string
    //
    // var hundreds = parseInt(dec[0], 16);
    // var tens = parseInt(dec[1], 16);
    // var ones = parseInt(dec[2], 16);
    //
    //
    // // and places the hundreds digit in memory at location in I,
    // memory[state.I] = hundreds;
    //
    // // the tens digit at location I+1,
    // memory[state.I+1] = tens;
    //
    // // and the ones digit at location I+2.
    // memory[state.I+2] = ones;

    var number = state.V[x],
      i;

    for (i = 3; i > 0; i--) {
      memory[state.I + i - 1] = parseInt(number % 10);
      number /= 10;
    }

    state.pc += 2;

    return 'LD Vx->mem';
  },
  0xf055: function(opcode, state, setState, memory) {
    // Store registers V0 through Vx in memory starting at location I.
    // The interpreter copies the values of registers V0 through Vx into memory, starting at the address in I.
    // I is set to I + X + 1 after operation

    var hexCode = opcode.toString(16); // convert opcode to hex value
    var x = parseInt(hexCode[1], 16); //

    for (var i = 0; i <= x; i++) {
      memory[state.I + i] = state.V[i];
    }

    state.I = state.I + x + 1;
    state.pc += 2;
  },

  0xf065: function(opcode, state, setState, memory) {
    // Read registers V0 through Vx from memory starting at location I.
    // The interpreter reads values from memory starting at location I into registers V0 through Vx.
    //
    // Fill registers V0 to VX inclusive with the values stored in memory starting at address I
    // I is set to I + X + 1 after operation
    //
    var hexCode = opcode.toString(16); // convert opcode to hex value
    var x = parseInt(hexCode[1], 16); //

    for (var i = 0; i <= x; i++) {
      state.V[i] = memory[state.I + i];
    }

    state.I = state.I + x + 1;
    state.pc += 2;

    return 'LD Vx, [I]';
  },
  /****************************
   ** Third Ranges
   /**************************/
  // FIXME: should this really be 3rd ranges? What would happen if we didn't use that method? and instead just sliced the hex numbers?
  0x00e0: function(opcode, state, setState) {
    // 0xe0 Clear the screen

    resetScreen(state);
    // setState({drawFlag: true});
    state.drawFlag = true;
    // set draw flag...
    state.pc += 2; //FIXME: verify which need these and which don't
  },

  0x00ee: function(opcode, state, setState) {
    // Return from a subroutine.
    // The interpreter sets the program counter to the address at the top of the stack, then subtracts 1 from the stack pointer.
    // console.log('#########eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee####################')

    // console.log('state.stack', state.stack )
    // state.pc = state.stack[0]; // is it always top of the stack?
    // state.stack.pop(); // remove stack[0] // last part of the stack

    // state.sp--;

    state.sp--;
    state.pc = state.stack[state.sp];

    // his way ?
    // state.pc = state.stack[--state.sp];

    state.pc += 2; // FIXME: verify that this is the case... I assume that if we leave this off we'll have infinite loops since this will return
    //
    // to the same point and then run that exact same code again
    // state.loopCount = 300;
    return 'RET - Return from a subroutine';
  },
};

// utils

// Fixme:
function resetScreen(state, setState) {
  // setState({
  //   // screen: new Array(64 * 32).fill(0), // 2048 items
  //   screen: new Array(32).fill(new Array(64).fill(0)), // 2048 items
  // });

  // state.screen = new Array(32).fill(new Array(64).fill(0)); // 2048 items

  state.screen = new Array(64 * 32).fill(0); // 2048 items
}

// FIXME: clean this up...
function setPixel(x, y, screen) {
  var location,
    width = 64, //this.getDisplayWidth(),
    height = 32; //this.getDisplayHeight();

  // If the pixel exceeds the dimensions,
  // wrap it back around.
  if (x > width) {
    x -= width;
  } else if (x < 0) {
    x += width;
  }

  if (y > height) {
    y -= height;
  } else if (y < 0) {
    y += height;
  }

  location = x + y * width;

  screen[location] ^= 1;

  return !screen[location];
}
