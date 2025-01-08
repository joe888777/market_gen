import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { MarketTest } from "../target/types/market_test";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAccount,
} from "@solana/spl-token";
import { MARKET_STATE_LAYOUT_V3 } from "@openbook-dex/openbook";
import { randomBytes } from "crypto";

describe("market-test", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MarketTest as Program<MarketTest>;
  const connection = provider.connection;

  const DEX_PROGRAM_ID = new PublicKey(
    "EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj"
  );
  // const DEX_PROGRAM_ID = new PublicKey(
  //   "EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj"
  // );
  const user = provider.wallet as NodeWallet;

  const seed = new anchor.BN(randomBytes(4));
  console.log("SEED", seed.toNumber());
  const MARKET_SEED = `market_${seed.toNumber()}`;
  const BIDS_SEED = `bids_${seed.toNumber()}`;
  const ASKS_SEED = `asks_${seed.toNumber()}`;
  const REQ_Q_SEED = `req_q_${seed.toNumber()}`;
  const EVENT_Q_SEED = `event_q_${seed.toNumber()}`;

  const COIN_LOT_SIZE = new anchor.BN(10);
  const PC_LOT_SIZE = new anchor.BN(100_000);
  const PC_DUST_THRESHOLD = new anchor.BN(10);

  // const market = Keypair.generate();

  const coin_mint = Keypair.generate();

  const pc_mint = Keypair.generate();
  let accounts;

  const createProgramAccount = (
    basedPublicKey,
    newAccountPubkey,
    lamports,
    space,
    seed,
    programId
  ) => {
    return SystemProgram.createAccountWithSeed({
      fromPubkey: user.publicKey,
      basePubkey: basedPublicKey,
      newAccountPubkey,
      seed,
      lamports,
      space,
      programId,
    });
  };

  const log = async (signature: string): Promise<string> => {
    console.log(
      `Your transaction signature: https://explorer.solana.com/transaction/${signature}?cluster=custom&customUrl=${connection.rpcEndpoint}`
    );
    return signature;
  };

  const [userAtaCoin, userAtaPc] = [user.publicKey]
    .map((a) =>
      [coin_mint, pc_mint].map((m) =>
        getAssociatedTokenAddressSync(m.publicKey, a, false, TOKEN_PROGRAM_ID)
      )
    )
    .flat();
  let market;
  let bids;
  let asks;
  let req_q;
  let event_q;
  let coin_vault;
  let pc_vault;
  let signer_vault_account;
  let nonce;
  coin_vault = Keypair.generate();
  pc_vault = Keypair.generate();

  beforeEach(async () => {
    market = await PublicKey.createWithSeed(
      user.publicKey,
      MARKET_SEED,
      DEX_PROGRAM_ID
    );

    bids = await PublicKey.createWithSeed(
      user.publicKey,
      BIDS_SEED,
      DEX_PROGRAM_ID
    );
    asks = await PublicKey.createWithSeed(
      user.publicKey,
      ASKS_SEED,
      DEX_PROGRAM_ID
    );
    req_q = await PublicKey.createWithSeed(
      user.publicKey,
      REQ_Q_SEED,
      DEX_PROGRAM_ID
    );
    event_q = await PublicKey.createWithSeed(
      user.publicKey,
      EVENT_Q_SEED,
      DEX_PROGRAM_ID
    );

    // important, should 
    [signer_vault_account, nonce] = PublicKey.findProgramAddressSync(
      [market.toBuffer()],
      DEX_PROGRAM_ID
    )

    //mint progress
    let lamports = await getMinimumBalanceForRentExemptMint(connection);
    let tx = new Transaction();
    tx.instructions = [
      ...[user].map((account) =>
        SystemProgram.transfer({
          fromPubkey: provider.publicKey,
          toPubkey: account.publicKey,
          lamports: 10 * LAMPORTS_PER_SOL,
        })
      ),
      ...[coin_mint, pc_mint].map((mint) =>
        SystemProgram.createAccount({
          fromPubkey: provider.publicKey,
          newAccountPubkey: mint.publicKey,
          lamports,
          space: MINT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        })
      ),
      ...[
        { mint: coin_mint, authority: user.publicKey, ata: userAtaCoin },
        { mint: pc_mint, authority: user.publicKey, ata: userAtaPc },
      ].flatMap((x) => [
        createInitializeMint2Instruction(
          x.mint.publicKey,
          6,
          x.authority,
          null,
          TOKEN_PROGRAM_ID
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          provider.publicKey,
          x.ata,
          x.authority,
          x.mint.publicKey,
          TOKEN_PROGRAM_ID
        ),
        createMintToInstruction(
          x.mint.publicKey,
          x.ata,
          x.authority,
          1e9,
          undefined,
          TOKEN_PROGRAM_ID
        ),
      ]),
    ];
    
    await provider
      .sendAndConfirm(tx, [user.payer, coin_mint, pc_mint])
      .then(log);
    //tx 1
    await createAccount(
      connection,
      user.payer,
      coin_mint.publicKey,
      signer_vault_account,
      coin_vault
    );
    await createAccount(
      connection,
      user.payer,
      pc_mint.publicKey,
      signer_vault_account,
      pc_vault
    );

    accounts = {
      market: market,
      coinMint: coin_mint.publicKey,
      pcMint: pc_mint.publicKey,
      coinVault: coin_vault.publicKey,
      pcVault: pc_vault.publicKey,
      bids: bids,
      asks: asks,
      reqQueue: req_q,
      eventQueue: event_q,
      authority: user.payer.publicKey,
    };

    //tx2
    const tx2 = new Transaction();

    console.log("txxxxx");
    tx2.add(
      createProgramAccount(
        user.publicKey,
        market,
        await connection.getMinimumBalanceForRentExemption(
          388
          // MARKET_STATE_LAYOUT_V3.span
        ),
        // MARKET_STATE_LAYOUT_V3.span,
        388,
        MARKET_SEED,
        DEX_PROGRAM_ID
      ),
      createProgramAccount(
        user.publicKey,
        req_q,
        await connection.getMinimumBalanceForRentExemption(764),
        // await connection.getMinimumBalanceForRentExemption(5120 + 12),
        764,
        REQ_Q_SEED,
        DEX_PROGRAM_ID
      ),
      createProgramAccount(
        user.publicKey,
        event_q,
        await connection.getMinimumBalanceForRentExemption(11308),
        // await connection.getMinimumBalanceForRentExemption(262144 + 12),
        11308,
        EVENT_Q_SEED,
        DEX_PROGRAM_ID
      ),
      createProgramAccount(
        user.publicKey,
        bids,
        await connection.getMinimumBalanceForRentExemption(14524),
        // await connection.getMinimumBalanceForRentExemption(65536 + 12),
        14524,
        BIDS_SEED,
        DEX_PROGRAM_ID
      ),
      createProgramAccount(
        user.publicKey,
        asks,
        await connection.getMinimumBalanceForRentExemption(14524),
        // await connection.getMinimumBalanceForRentExemption(65536 + 12),
        14524,
        ASKS_SEED,
        DEX_PROGRAM_ID
      )
    );
    console.log("tx222222222");
    await sendAndConfirmTransaction(connection, tx2, [user.payer]);
    console.log("tx000000000");
  });

  it("Is initialized!", async () => {
    try {
      console.log("accounts", accounts);
      const tx = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
        await program.methods
          .initialize(
            COIN_LOT_SIZE,
            PC_LOT_SIZE,
            PC_DUST_THRESHOLD,
            new anchor.BN(nonce),
          )
          .accounts(accounts)
          .instruction()
      );
      tx.feePayer = user.publicKey;
      tx.recentBlockhash = (
        await provider.connection.getLatestBlockhash()
      ).blockhash;
      console.log(await provider.connection.simulateTransaction(tx));
      const sig = await sendAndConfirmTransaction(
        provider.connection,
        tx,
        [user.payer],
        {
          skipPreflight: true,
        }
      );
      console.log(
        "Successfully in initialize : ",
        `https://solscan.io/tx/${sig}?cluster=devnet`
      );
    } catch (error) {
      console.log("Error in initialize", error);
    }
    // Add your test here.
  });
});

const ggg = {
  //on curve
  marketId: "6JV2zbo3CJassywQ5gWZJ7QaK1aF9wxYtNuA5yBWyiLi",
  requestQueue: "AqPCeoPpi4pNR4fmVvYx6vghF1USjTVQNdqg8e9ctEPP",
  eventQueue: "6CpmJyFpmQEB3kdoNWuYKHbP4Tk9xez7CtQuSHbVizUA",
  bids: "J9p7doHGWzPkdtxCUhyPh9AStshxznZnjeZStRQezrHo",
  asks: "6wDrkH4ZfDxuRaxyKEKbNiLgkFBaW34NhRZnqrWEuBCn",
  baseVault: "FuhuGpxEhPaaZPDvX5ygGBqtmT7VgRHUzKpEkpXdBLgk",
  quoteVault: "9BFcmo2aHV3JexBm88FBvEJyfS4sA3PBxqi6yt1pc9hs",
  baseMint: "BehfkowGJ6HAwfdhY23J8XzPXvZGRXNoZpPtKR9QGst3",
  quoteMin: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
};
