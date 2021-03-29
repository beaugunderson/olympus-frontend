<template>
  <div>
    <div id="dapp" class="dapp overflow-hidden">
      <!-- <VueLoadingIndicator v-if="settings.loading" class="overlay big" /> 
      <div v-else>
      </div>-->
      <div class="dapp-sidebar">
        <div class="dapp-menu-top">
          <div class="branding-header">
            <router-link :to="{ name: 'home' }" class="">
              <img class="branding-header-icon" src="~/@/assets/logo.svg" alt="" />
            </router-link>
          </div>
          <div class="wallet-menu">
            <a
              v-if="address"
              class="disconnect-button button-primary button"
              @click="$store.state.settings.address = ''"
              >Disconnect</a
            >
            <a v-if="address" class="dapp-sidebar-button-connected button button-info">
              <span class="login-bullet mr-2 ml-n2" />
              {{ shorten(address) }}
            </a>
            <a
              v-else
              class="dapp-sidebar-button-connect button button-primary"
              @click="modalLoginOpen = true"
            >
              Connect wallet
            </a>
          </div>
        </div>

        <div class="dapp-menu-links">
          <Dav />
        </div>

        <div class="dapp-menu-social">
          <Social />
        </div>
      </div>
      <div class="wrapper">
        <div class="dapp-center-modal">
          <div class="dapp-modal-wrapper">
            <div class="swap-input-column">
              <div class="stake-toggle-row">
                <toggle-switch
                  :options="myOptions"
                  v-model="selectedMapOption"
                  :value="selectedMapOption"
                />
              </div>

              <div class="swap-input-row">
                <div class="stake-input-container">
                  <input
                    v-model="quantity"
                    placeholder="Type an amount"
                    class="stake-input"
                    type="text"
                  />
                </div>
              </div>
              <div class="stake-amount-preset-row">
                <div class="stake-amount-preset-button hasEffect" @click="setStake(25)">
                  25%
                </div>
                <div class="stake-amount-preset-button hasEffect" @click="setStake(50)">
                  50%
                </div>
                <div class="stake-amount-preset-button hasEffect" @click="setStake(75)">
                  75%
                </div>
                <div class="stake-amount-preset-button hasEffect" @click="setStake(100)">
                  100%
                </div>
              </div>

              <div class="stake-price-data-column">
                <div class="stake-price-data-row">
                  <p class="price-label">Balance</p>
                  <p class="price-data">{{ trim($store.state.settings.ohmBalance, 4) }} OHM</p>
                </div>

                <div class="stake-price-data-row">
                  <p class="price-label">% of supply</p>
                  <p class="price-data">
                    {{ trim($store.state.settings.percentOfCirculatingOhmSupply, 4) }}%
                  </p>
                </div>

                <div class="stake-price-data-row">
                  <p class="price-label">Staked</p>
                  <p class="price-data">{{ trim($store.state.settings.sohmBalance, 4) }} OHM</p>
                </div>

                <div class="stake-price-data-row">
                  <p class="price-label">% of supply</p>
                  <p class="price-data">
                    {{ trim($store.state.settings.percentOfCirculatingSOhmSupply, 4) }}%
                  </p>
                </div>

                <div class="stake-price-data-row">
                  <p class="price-label">Rebase block</p>
                  <p class="price-data">
                    {{
                      $store.state.settings.epochBlock
                        ? `${$store.state.settings.epochBlock} (${
                            $store.state.settings.epochBlocksAway
                          } blocks, ${($store.state.settings.epochSecondsAway / 60 / 60).toFixed(
                            1
                          )} hours)`
                        : ''
                    }}
                  </p>
                </div>

                <div class="stake-price-data-row">
                  <p class="price-label">Upcoming rebase</p>
                  <p class="price-data">{{ trim($store.state.settings.stakingRebase, 4) }}%</p>
                  <!-- profit / staked supply -->
                </div>

                <div class="stake-price-data-row">
                  <p class="price-label">Upcoming APY</p>
                  <p class="price-data">{{ trim($store.state.settings.stakingAPY, 2) }}%</p>
                  <!-- 1+rebase^1095-1 -->
                </div>

                <div class="stake-price-data-row">
                  <p class="price-label">Current index</p>
                  <p class="price-data">{{ trim($store.state.settings.currentIndex, 4) }} OHM</p>
                </div>
              </div>

              <div v-if="hasAllowance" class="stake-button-container">
                <div class="stake-button" @click="executeStake">{{ selectedMapOption }}</div>
              </div>
              <div v-else class="stake-button-container">
                <div class="stake-button" @click="seekApproval">Approve</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <ModalLogin :open="modalLoginOpen" @close="modalLoginOpen = false" />
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';
import { shorten } from '@/helpers/utils.ts';
import { ethers } from 'ethers';

export default {
  data() {
    return {
      myOptions: {
        layout: {
          color: 'white',
          backgroundColor: '#282828',
          selectedColor: 'white',
          selectedBackgroundColor: 'green',
          borderColor: 'white',
          fontFamily: 'Arial',
          fontWeight: 'normal',
          lineHeight: '1',
          fontWeightSelected: 'bold',
          squareCorners: false,
          noBorder: false
        },
        size: {
          fontSize: 1,
          height: 2.5,
          padding: 0.3,
          width: 15,
          borderRadius: 5
        },
        items: {
          delay: 0.4,
          preSelected: 'unknown',
          disabled: false,
          labels: [
            { name: 'Stake', color: 'black', backgroundColor: 'white' },
            { name: 'Unstake', color: 'black', backgroundColor: 'white' }
          ]
        }
      },
      selectedMapOption: 'Stake',
      quantity: '',
      stakeToggle: true,
      modalLoginOpen: false
    };
  },
  computed: {
    ...mapState(['settings']),
    isValid() {
      return parseFloat(this.form.quantity);
    },
    address() {
      if (this.$store.state.settings.address) return this.$store.state.settings.address;
      return null;
    },
    hasAllowance() {
      if (parseFloat(this.quantity)) {
        switch (this.selectedMapOption) {
          case 'Stake':
            return (
              parseInt(this.$store.state.settings.stakeAllowance) >=
              parseInt(ethers.utils.parseUnits(this.quantity.toString(), 'gwei'))
            );
          case 'Unstake':
            return (
              parseInt(this.$store.state.settings.unstakeAllowance) >=
              parseInt(ethers.utils.parseUnits(this.quantity.toString(), 'gwei'))
            );
        }
      }
      return false;
    }
  },

  methods: {
    ...mapActions([
      'SendDai',
      'getStakeApproval',
      'stakeOHM',
      'unstakeOHM',
      'getunStakeApproval',
      'getStakingAPY'
    ]),
    async executeStake() {
      console.log(this.selectedMapOption);
      switch (this.selectedMapOption) {
        case 'Stake':
          await this.stakeOHM(this.quantity.toString());
          break;
        case 'Unstake':
          await this.unstakeOHM(this.quantity.toString());
      }
      //updatestats
    },
    setStake(value) {
      switch (this.selectedMapOption) {
        case 'Stake':
          this.quantity = (this.$store.state.settings.ohmBalance * value) / 100;
          break;
        case 'Unstake':
          this.quantity = (this.$store.state.settings.sohmBalance * value) / 100;
      }
    },

    trim(number, precision) {
      if (number == undefined) {
        number = 0;
      }
      const array = number.toString().split('.');
      array.push(array.pop().substring(0, precision));
      const trimmedNumber = array.join('.');
      return trimmedNumber;
    },

    async seekApproval() {
      switch (this.selectedMapOption) {
        case 'Stake':
          await this.getStakeApproval(this.quantity.toString());
          break;
        case 'Unstake':
          await this.getunStakeApproval(this.quantity.toString());
      }
    },
    shorten(addr) {
      return shorten(addr);
    },
    maxStake() {
      this.form.quantity = this.$store.state.settings.balance;
    },
    disconnect() {
      if (this.$store.state.settings.address) return this.$store.state.address.initial;
      return null;
    }
  }
};
</script>
<style scoped>
.hasEffect {
  cursor: pointer;
}
</style>
