import Vue from 'vue';
import { ethers } from 'ethers';
import store from '@/store';
//import provider from '@/helpers/provider';
import addresses from '@/helpers/addresses';
import {
  getExchangeRatesFromCoinGecko,
  getPotions,
  getAllowances,
  revitalisePotion,
  withdrawPotion
} from '@/helpers/utils';
import assets from '@/helpers/assets.json';
import { abi as ierc20Abi } from '@/helpers/abi/IERC20.json';
import { abi as mimirTokenSale } from '@/helpers/abi/mimirTokenSale.json';
import { abi as pOlyTokenSale } from '@/helpers/abi/pOlyTokenSale.json';
import { abi as OHMPreSale } from '@/helpers/abi/OHMPreSale.json';
import { abi as OlympusStaking } from '@/helpers/abi/OlympusStaking.json';
import { abi as MigrateToOHM } from '@/helpers/abi/MigrateToOHM.json';
import { abi as sOHM } from '@/helpers/abi/sOHM.json';
import { abi as LPStaking } from '@/helpers/abi/LPStaking.json';
import { abi as DistributorContract } from '@/helpers/abi/DistributorContract.json';

import { whitelist } from '@/helpers/whitelist.json';

const parseEther = ethers.utils.parseEther;

let provider;

const ethereum = window['ethereum'];
if (ethereum) {
  ethereum.on('accountsChanged', () => store.dispatch('init'));
  ethereum.on('networkChanged', network => {
    store.dispatch('init');
  });
}

const EPOCH_INTERVAL = 2200;

// NOTE could get this from an outside source since it changes slightly over time
const BLOCK_RATE_SECONDS = 13.14;

async function getNextEpoch(): Promise<[number, number, number]> {
  const height = await provider.getBlockNumber();

  if (height % EPOCH_INTERVAL === 0) {
    return [0, 0, 0];
  }

  const next = height + EPOCH_INTERVAL - (height % EPOCH_INTERVAL);
  const blocksAway = next - height;
  const secondsAway = blocksAway * BLOCK_RATE_SECONDS;

  return [next, blocksAway, secondsAway];
}

const MARKET_API_URL =
  'https://api.coingecko.com/api/v3/coins/olympus?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false';

async function getSupplyAndMarketCap() {
  try {
    const result = await fetch(MARKET_API_URL);
    const json = await result.json();

    return {
      circulatingSupply: json.market_data.circulating_supply,
      marketCap: json.market_data.market_cap.usd,
      currentPrice: json.market_data.current_price.usd
    };
  } catch (e) {
    return {
      circulatingSupply: 0,
      marketCap: 0,
      currentPrice: 0
    };
  }
}

const state = {
  approval: 0,
  loading: false,
  address: null,
  name: '',
  whitelisted: false,
  balance: 0,
  ohmBalance: 0,
  claim: 0,
  minimumEth: 0,
  providedEth: 0,
  amount: 0,
  remainingEth: 0,
  network: { chainId: 0 },
  exchangeRates: {},
  allowance: 0,
  stakeAllowance: 0,
  unstakeAllowance: 0,
  balances: {},
  authorized: false,
  allowanceTx: 0,
  saleTx: 0,
  confirmations: 1,
  allotment: 0,
  maxPurchase: 0,
  maxSwap: 0,
  amountSwap: 0,
  epochBlock: null,
  epochBlocksAway: null,
  epochSecondsAway: null
};

const mutations = {
  set(_state, payload) {
    Object.keys(payload).forEach(key => {
      Vue.set(_state, key, payload[key]);
    });
  }
};

const actions = {
  init: async ({ commit, dispatch }) => {
    commit('set', { loading: true });
    // @ts-ignore
    if (typeof window.ethereum !== 'undefined') {
      const ethereum = window['ethereum'];
      provider = new ethers.providers.Web3Provider(ethereum);
    }

    if (provider) {
      try {
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        if (address) await dispatch('login');
      } catch (e) {
        console.log(e);
      }
    }
    commit('set', { loading: false });
  },
  login: async ({ commit, dispatch }) => {
    if (provider) {
      try {
        await ethereum.enable();
        provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        console.log('error address: ' + address);
        // const name = await provider.lookupAddress(address);
        // Throws errors with non ENS compatible testnets
        const network = await provider.getNetwork();
        store.commit('set', { network: network });

        const aOHMContract = await new ethers.Contract(
          addresses[state.network.chainId].AOHM_ADDRESS,
          ierc20Abi,
          provider
        );
        const aOHMBalanceBeforeDecimals = await aOHMContract.balanceOf(address);
        const aOHMBalance = aOHMBalanceBeforeDecimals / 1000000000;

        let ohmContract,
          ohmBalance = ethers.constants.Zero,
          allowance = 0;
        let sohmContract,
          sohmMainContract,
          sohmBalance = ethers.constants.Zero,
          stakeAllowance = 0,
          unstakeAllowance = 0,
          circSupply = 0;
        let stakingContract,
          profit = 0;
        let lpStakingContract,
          totalLPStaked = 0,
          lpStaked = 0,
          pendingRewards = 0,
          lpStakingAPY;
        let lpContract,
          lpBalance = 0,
          lpStakeAllowance;
        let distributorContract,
          stakingAPY = 0,
          stakingRebase = 0,
          stakingReward = 0;
        let distributorContractSigner,
          currentIndex = 0;

        const ohmSupply = 0;
        const ohmMarketCap = 0;

        if (whitelist.includes(address)) commit('set', { whitelisted: true });

        const daiContract = new ethers.Contract(
          addresses[network.chainId].DAI_ADDRESS,
          ierc20Abi,
          provider
        );
        const balance = await daiContract.balanceOf(address);
        allowance = await daiContract.allowance(
          address,
          addresses[network.chainId].PRESALE_ADDRESS
        )!;

        if (addresses[network.chainId].LP_ADDRESS) {
          lpContract = new ethers.Contract(
            addresses[network.chainId].LP_ADDRESS,
            ierc20Abi,
            provider
          );
          lpBalance = await lpContract.balanceOf(address);
        }

        if (addresses[network.chainId].LPSTAKING_ADDRESS) {
          lpStakingContract = new ethers.Contract(
            addresses[network.chainId].LPSTAKING_ADDRESS,
            LPStaking,
            provider
          );
          lpContract = new ethers.Contract(
            addresses[network.chainId].LP_ADDRESS,
            ierc20Abi,
            provider
          );
          ohmContract = new ethers.Contract(
            addresses[network.chainId].OHM_ADDRESS,
            ierc20Abi,
            provider
          );

          totalLPStaked = await lpStakingContract.totalStaked();
          lpStaked = await lpStakingContract.getUserBalance(address);
          pendingRewards = await lpStakingContract.pendingRewards(address);
          lpStakeAllowance = await lpContract.allowance(
            address,
            addresses[state.network.chainId].LPSTAKING_ADDRESS
          );

          const totalLP = await lpContract.totalSupply();
          const OHMInLP = await ohmContract.balanceOf(addresses[network.chainId].LP_ADDRESS);

          const rewardPerBlock = await lpStakingContract.rewardPerBlock();

          // alert(totalLPStaked);
          // alert(OHMInLP);
          // alert(totalLP);

          lpStakingAPY =
            (rewardPerBlock * 6650 * 366 * 100) / (((totalLPStaked * OHMInLP) / totalLP) * 2);
          //alert( lpStakingAPY );
        }

        if (addresses[network.chainId].OHM_ADDRESS) {
          ohmContract = new ethers.Contract(
            addresses[network.chainId].OHM_ADDRESS,
            ierc20Abi,
            provider
          );
          ohmBalance = await ohmContract.balanceOf(address);
          stakeAllowance = await ohmContract.allowance(
            address,
            addresses[network.chainId].STAKING_ADDRESS
          )!;
        }
        if (addresses[network.chainId].SOHM_ADDRESS) {
          sohmContract = new ethers.Contract(
            addresses[network.chainId].SOHM_ADDRESS,
            ierc20Abi,
            provider
          );
          sohmMainContract = new ethers.Contract(
            addresses[network.chainId].SOHM_ADDRESS,
            sOHM,
            provider
          );

          sohmBalance = await sohmContract.balanceOf(address);
          unstakeAllowance = await sohmContract.allowance(
            address,
            addresses[network.chainId].STAKING_ADDRESS
          )!;
          circSupply = await sohmMainContract.circulatingSupply();
        }
        if (addresses[network.chainId].STAKING_ADDRESS) {
          stakingContract = new ethers.Contract(
            addresses[network.chainId].STAKING_ADDRESS,
            OlympusStaking,
            provider
          );
          profit = await stakingContract.ohmToDistributeNextEpoch();
        }

        if (addresses[network.chainId].DISTRIBUTOR_ADDRESS) {
          distributorContract = new ethers.Contract(
            addresses[network.chainId].DISTRIBUTOR_ADDRESS,
            DistributorContract,
            provider
          );
          sohmContract = new ethers.Contract(
            addresses[network.chainId].SOHM_ADDRESS,
            ierc20Abi,
            provider
          );

          circSupply = await sohmMainContract.circulatingSupply();

          stakingReward = await distributorContract.getCurrentRewardForNextEpoch();

          stakingRebase = stakingReward / circSupply;

          stakingAPY = Math.pow(1 + stakingRebase, 1095);

          stakingAPY = stakingAPY * 100;

          stakingRebase = stakingRebase * 100;

          currentIndex = await sohmContract.balanceOf('0xA62Bee23497C920B94305FF68FA7b1Cd1e9FAdb2');
        }

        const [epochBlock, epochBlocksAway, epochSecondsAway] = await getNextEpoch();
        const { circulatingSupply, marketCap, currentPrice } = await getSupplyAndMarketCap();

        const supplyInGwei = ethers.utils.parseUnits(circulatingSupply.toFixed(5), 'gwei');

        console.log({ supplyInGwei: supplyInGwei.toString() });

        const percentOfCirculatingOhmSupply = ohmBalance.gt(ethers.constants.Zero)
          ? (ohmBalance.toNumber() / supplyInGwei.toNumber()) * 100
          : 0;

        const percentOfCirculatingSOhmSupply = sohmBalance.gt(ethers.constants.Zero)
          ? (sohmBalance.toNumber() / supplyInGwei.toNumber()) * 100
          : 0;

        commit('set', { address });
        commit('set', {
          // name,
          balance: ethers.utils.formatEther(balance),
          aOHMBalance: aOHMBalance,
          network,
          loading: false,
          ohmBalance: ethers.utils.formatUnits(ohmBalance, 'gwei'),
          sohmBalance: ethers.utils.formatUnits(sohmBalance, 'gwei'),
          totalLPStaked: ethers.utils.formatUnits(totalLPStaked, 'ether'),
          lpBalance: ethers.utils.formatUnits(lpBalance, 'ether'),
          lpStaked: ethers.utils.formatUnits(lpStaked, 'ether'),
          pendingRewards: ethers.utils.formatUnits(pendingRewards, 'gwei'),
          lpStakingAPY: lpStakingAPY,
          stakingReward: ethers.utils.formatUnits(stakingReward, 'gwei'),
          stakingAPY: stakingAPY,
          stakingRebase: stakingRebase,
          currentIndex: ethers.utils.formatUnits(currentIndex, 'gwei'),
          epochBlock,
          epochBlocksAway,
          epochSecondsAway,
          percentOfCirculatingOhmSupply,
          percentOfCirculatingSOhmSupply
        });
        commit('set', { allowance, stakeAllowance, unstakeAllowance, lpStakeAllowance });
        dispatch('getAllotmentPerBuyer');
      } catch (error) {
        console.error(error);
      }
    } else {
      console.error('This website require MetaMask');
    }
  },
  loading: ({ commit }, payload) => {
    commit('set', { loading: payload });
  },
  async getExchangeRates({ commit }) {
    const exchangeRates = await getExchangeRatesFromCoinGecko();
    commit('set', { exchangeRates });
  },

  async getOHM({ commit }, value) {
    const signer = provider.getSigner();
    const presale = await new ethers.Contract(
      addresses[state.network.chainId].PRESALE_ADDRESS,
      OHMPreSale,
      signer
    );
    const daiContract = new ethers.Contract(
      addresses[state.network.chainId].DAI_ADDRESS,
      ierc20Abi,
      signer
    );

    const presaleTX = await presale.purchaseaOHM(ethers.utils.parseEther(value).toString());
    await presaleTX.wait(console.log('Success'));
    const balance = await daiContract.balanceOf(state.address);
    commit('set', {
      // name,
      balance: ethers.utils.formatEther(balance)
    });
  },

  async getApproval({ commit, dispatch }, value) {
    const signer = provider.getSigner();
    const daiContract = await new ethers.Contract(
      addresses[state.network.chainId].DAI_ADDRESS,
      ierc20Abi,
      signer
    );

    if (value <= 0) return;

    const approveTx = await daiContract.approve(
      addresses[state.network.chainId].PRESALE_ADDRESS,
      ethers.utils.parseEther(value).toString()
    );
    commit('set', { allowanceTx: 1 });
    await approveTx.wait();
    await dispatch('getAllowances');
  },

  async getAllowances({ commit }) {
    if (state.address) {
      const diaContract = await new ethers.Contract(
        addresses[state.network.chainId].DAI_ADDRESS,
        ierc20Abi,
        provider
      );
      const allowance = await diaContract.allowance(
        state.address,
        addresses[state.network.chainId].PRESALE_ADDRESS
      );
      commit('set', { allowance });
    }
  },

  async getStakeApproval({ commit, dispatch }, value) {
    const signer = provider.getSigner();
    const ohmContract = await new ethers.Contract(
      addresses[state.network.chainId].OHM_ADDRESS,
      ierc20Abi,
      signer
    );
    if (value <= 0) return;

    const approveTx = await ohmContract.approve(
      addresses[state.network.chainId].STAKING_ADDRESS,
      ethers.utils.parseUnits('1000000000', 'gwei').toString()
    );
    await approveTx.wait();
    await dispatch('getStakeAllowances');
  },

  async getLPStakeApproval({ commit, dispatch }, value) {
    const signer = provider.getSigner();
    const lpContract = await new ethers.Contract(
      addresses[state.network.chainId].LP_ADDRESS,
      ierc20Abi,
      signer
    );
    if (value <= 0) return;

    const approveTx = await lpContract.approve(
      addresses[state.network.chainId].LPSTAKING_ADDRESS,
      ethers.utils.parseUnits('1000000000', 'ether').toString()
    );
    await approveTx.wait();
    await dispatch('getLPStakeAllowance');
  },

  async getStakeAllowances({ commit }) {
    if (state.address) {
      const ohmContract = await new ethers.Contract(
        addresses[state.network.chainId].OHM_ADDRESS,
        ierc20Abi,
        provider
      );
      const stakeAllowance = await ohmContract.allowance(
        state.address,
        addresses[state.network.chainId].STAKING_ADDRESS
      );
      commit('set', { stakeAllowance });
    }
  },

  async getLPStakeAllowance({ commit }) {
    if (state.address) {
      const lpContract = await new ethers.Contract(
        addresses[state.network.chainId].LP_ADDRESS,
        ierc20Abi,
        provider
      );
      const lpStakeAllowance = await lpContract.allowance(
        state.address,
        addresses[state.network.chainId].LPSTAKING_ADDRESS
      );
      commit('set', { lpStakeAllowance });
    }
  },

  async getunStakeApproval({ commit, dispatch }, value) {
    const signer = provider.getSigner();
    const sohmContract = await new ethers.Contract(
      addresses[state.network.chainId].SOHM_ADDRESS,
      ierc20Abi,
      signer
    );
    if (value <= 0) return;

    const approveTx = await sohmContract.approve(
      addresses[state.network.chainId].STAKING_ADDRESS,
      ethers.utils.parseUnits('1000000000', 'gwei').toString()
    );
    await approveTx.wait();
    await dispatch('getunStakeAllowances');
  },

  async getunStakeAllowances({ commit }) {
    if (state.address) {
      const sohmContract = await new ethers.Contract(
        addresses[state.network.chainId].SOHM_ADDRESS,
        ierc20Abi,
        provider
      );
      const unstakeAllowance = await sohmContract.allowance(
        state.address,
        addresses[state.network.chainId].STAKING_ADDRESS
      );
      commit('set', { unstakeAllowance });
    }
  },
  async calculateSaleQuote({ commit }, value) {
    const presale = await new ethers.Contract(
      addresses[state.network.chainId].PRESALE_ADDRESS,
      OHMPreSale,
      provider
    );
    const amount = await presale.calculateSaleQuote(ethers.utils.parseUnits(value, 'ether'));
    commit('set', { amount: ethers.utils.formatUnits(amount.toString(), 'gwei').toString() });
  },

  async getAllotmentPerBuyer({ commit }) {
    const presale = await new ethers.Contract(
      addresses[state.network.chainId].PRESALE_ADDRESS,
      OHMPreSale,
      provider
    );
    const allotment = await presale.getAllotmentPerBuyer();
    commit('set', { allotment: ethers.utils.formatUnits(allotment, 'gwei') });
  },

  async getMaxPurchase({ commit, dispatch }) {
    const presale = await new ethers.Contract(
      addresses[state.network.chainId].PRESALE_ADDRESS,
      OHMPreSale,
      provider
    );
    const salePrice = await presale.salePrice();
    const total = state.allotment * salePrice;

    commit('set', { maxPurchase: ethers.utils.formatUnits(total.toString(), 'ether') });
  },

  async stakeOHM({ commit }, value) {
    const signer = provider.getSigner();
    const staking = await new ethers.Contract(
      addresses[state.network.chainId].STAKING_ADDRESS,
      OlympusStaking,
      signer
    );

    const stakeTx = await staking.stakeOHM(ethers.utils.parseUnits(value, 'gwei'));
    await stakeTx.wait();
    const ohmContract = new ethers.Contract(
      addresses[state.network.chainId].OHM_ADDRESS,
      ierc20Abi,
      provider
    );
    const ohmBalance = await ohmContract.balanceOf(state.address);
    const sohmContract = new ethers.Contract(
      addresses[state.network.chainId].SOHM_ADDRESS,
      ierc20Abi,
      provider
    );
    const sohmBalance = await sohmContract.balanceOf(state.address);
    commit('set', {
      ohmBalance: ethers.utils.formatUnits(ohmBalance, 'gwei'),
      sohmBalance: ethers.utils.formatUnits(sohmBalance, 'gwei')
    });
  },
  async unstakeOHM({ commit }, value) {
    const signer = provider.getSigner();
    const staking = await new ethers.Contract(
      addresses[state.network.chainId].STAKING_ADDRESS,
      OlympusStaking,
      signer
    );
    console.log(ethers.utils.parseUnits(value, 'gwei').toString());
    const stakeTx = await staking.unstakeOHM(ethers.utils.parseUnits(value, 'gwei'));
    await stakeTx.wait();
    const ohmContract = new ethers.Contract(
      addresses[state.network.chainId].OHM_ADDRESS,
      ierc20Abi,
      provider
    );
    const ohmBalance = await ohmContract.balanceOf(state.address);
    const sohmContract = new ethers.Contract(
      addresses[state.network.chainId].SOHM_ADDRESS,
      ierc20Abi,
      provider
    );
    const sohmBalance = await sohmContract.balanceOf(state.address);
    commit('set', {
      ohmBalance: ethers.utils.formatUnits(ohmBalance, 'gwei'),
      sohmBalance: ethers.utils.formatUnits(sohmBalance, 'gwei')
    });
  },

  async stakeLP({ commit }, value) {
    const signer = provider.getSigner();
    const staking = await new ethers.Contract(
      addresses[state.network.chainId].LPSTAKING_ADDRESS,
      LPStaking,
      signer
    );
    const stakeTx = await staking.stakeLP(ethers.utils.parseUnits(value, 'ether'));
    await stakeTx.wait();

    const lpContract = new ethers.Contract(
      addresses[state.network.chainId].LP_ADDRESS,
      ierc20Abi,
      provider
    );
    const lpBalance = await lpContract.balanceOf(state.address);
    const lpStakingContract = new ethers.Contract(
      addresses[state.network.chainId].LPSTAKING_ADDRESS,
      LPStaking,
      provider
    );
    const lpStaked = await lpStakingContract.getUserBalance(state.address);
    commit('set', {
      lpBalance: ethers.utils.formatUnits(lpBalance, 'ether'),
      lpStaked: ethers.utils.formatUnits(lpStaked, 'ether')
    });
  },

  async unstakeLP({ commit }, value) {
    const signer = provider.getSigner();
    const staking = await new ethers.Contract(
      addresses[state.network.chainId].LPSTAKING_ADDRESS,
      LPStaking,
      signer
    );
    const unstakeTx = await staking.unstakeLP();
    await unstakeTx.wait();

    const lpContract = new ethers.Contract(
      addresses[state.network.chainId].LP_ADDRESS,
      ierc20Abi,
      provider
    );
    const lpBalance = await lpContract.balanceOf(state.address);
    const lpStakingContract = new ethers.Contract(
      addresses[state.network.chainId].LPSTAKING_ADDRESS,
      LPStaking,
      provider
    );
    const lpStaked = await lpStakingContract.getUserBalance(state.address);
    commit('set', {
      lpBalance: ethers.utils.formatUnits(lpBalance, 'ether'),
      lpStaked: ethers.utils.formatUnits(lpStaked, 'ether')
    });
  },

  async claimRewards() {
    const signer = provider.getSigner();
    const staking = await new ethers.Contract(
      addresses[state.network.chainId].LPSTAKING_ADDRESS,
      LPStaking,
      signer
    );
    const claimTx = await staking.claimRewards();
    await claimTx.wait();
  },

  async getMaxSwap({ commit, dispatch }) {
    const aOHMContract = await new ethers.Contract(
      addresses[state.network.chainId].AOHM_ADDRESS,
      ierc20Abi,
      provider
    );
    const aOHMBalanceBeforeDecimals = await aOHMContract.balanceOf(state.address);
    const aOHMBalance = aOHMBalanceBeforeDecimals / 1000000000;

    commit('set', { maxSwap: aOHMBalance });
  },

  async migrateToOHM({ commit }, value) {
    const signer = provider.getSigner();
    const migrateContact = await new ethers.Contract(
      addresses[state.network.chainId].MIGRATE_ADDRESS,
      MigrateToOHM,
      signer
    );

    const aOHMContract = await new ethers.Contract(
      addresses[state.network.chainId].AOHM_ADDRESS,
      ierc20Abi,
      provider
    );
    const aOHMContractWithSigner = aOHMContract.connect(signer);

    const allowance = await aOHMContract.allowance(
      state.address,
      addresses[state.network.chainId].MIGRATE_ADDRESS
    );

    if (allowance < value * 1000000000) {
      const approveTx = await aOHMContractWithSigner.approve(
        addresses[state.network.chainId].MIGRATE_ADDRESS,
        parseEther((1e9).toString())
      );
      commit('set', { allowanceTx: 1 });
      await approveTx.wait(state.confirmations);
    }

    const migrateTx = await migrateContact.migrate(value * 1000000000);
    await migrateTx.wait();
  }
};

export default {
  state,
  mutations,
  actions
};
