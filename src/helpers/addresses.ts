import { ethers } from 'ethers';
import provider from '@/helpers/provider';

const addresses = { 
    4: {
        DAI_ADDRESS: '0xFd08f094B0eFe901aD95B650A382fc6468b374de',
        OHM_ADDRESS: '0xfc1ba9d9568a65ecab3a466959aae06ebcf05704',
        STAKING_ADDRESS: '0xA33a1015847569221f7613E89BB463AE6d628799',
        SOHM_ADDRESS: '0x83b334767f0C60C01938e695288ada176Ae03C6B',
        PRESALE_ADDRESS: '0x90d1dd1fa2fddd5076850f342f31717a0556fdf7',  
        AOHM_ADDRESS: '0x410D96DF0F9e778d0E3a7B93547e40f06e823618',
        MIGRATE_ADDRESS: '0x3BA7C6346b93DA485e97ba55aec28E8eDd3e33E2',
        LPSTAKING_ADDRESS: '0x797C6E26D099b971cc95138D55729a58B34c5e6B',
        LP_ADDRESS: '0xc6d0e140a030e4efe2fb561160a9d0e9e349ca67'
    },
    1: {
        DAI_ADDRESS: '0x6b175474e89094c44da98b954eedeac495271d0f',
        OHM_ADDRESS: '0x383518188c0c6d7730d91b2c03a03c837814a899',
        STAKING_ADDRESS: '0x0822F3C03dcc24d200AFF33493Dc08d0e1f274A2',
        SOHM_ADDRESS: '0x31932E6e45012476ba3A3A4953cbA62AeE77Fbbe',
        PRESALE_ADDRESS: '0xcBb60264fe0AC96B0EFa0145A9709A825afa17D8',
        AOHM_ADDRESS: '0x24ecfd535675f36ba1ab9c5d39b50dc097b0792e',
        MIGRATE_ADDRESS: '0xC7f56EC779cB9e60afA116d73F3708761197dB3d',
        LPSTAKING_ADDRESS: '0xF11f0F078BfaF05a28Eac345Bb84fcb2a3722223',
        LP_ADDRESS: '0x34d7d7Aaf50AD4944B70B320aCB24C95fa2def7c',
        DISTRIBUTOR_ADDRESS: '0x2ce62B196EA521C88D6CF884283cb0372f4a6cd1'
    }
};

export default addresses;
