<p align="center"><img src="docs/logo.svg" width="96" alt="" /></p>

# ranktally

[![CI](https://github.com/Gulliby-development/ranktally/actions/workflows/ci.yml/badge.svg)](https://github.com/Gulliby-development/ranktally/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

ranktally is an offline command-line tool for counting ranked-ballot elections. It is for clubs, committees, course groups, and scripts that need a deterministic result they can explain without a spreadsheet. Give it one election file and it reports results from five methods, compares their winners, and shows head-to-head counts.

## Install

Install [Bun](https://bun.sh/) if it is not already available, then run `bun install` once in the project directory. There is no build step: run commands directly with `bun run src/main.ts COMMAND`.

## Usage

The command synopsis is:

~~~text
usage: ranktally tally [--seats N] [--winner-only] METHOD FILE
       ranktally compare FILE
       ranktally pairwise [--margins] FILE
~~~

FILE is a path to an election file or `-` to read standard input. `--help` by itself prints the synopsis; elsewhere it is treated as an unknown command or option. `--seats N` accepts 1 through 11, defaults to 1, and applies only to STV; for STV, N must also be less than the number of candidates. `--winner-only` prints just the tally result, while `--margins` shows signed pairwise margins instead of raw counts.

To try the supplied election, save this as lunch.txt. The repository does not ship lunch.txt:

~~~text
# lunch vote
candidates Pizza Ramen Sushi Tacos Salad

7: Tacos > Ramen
7: Salad > Ramen = Sushi > Tacos
5: Pizza > Sushi > Salad > Tacos > Ramen
8: Ramen > Sushi > Tacos > Pizza > Salad
4: Pizza
5: Pizza > Tacos > Ramen
3: Pizza
7: Sushi > Tacos > Salad = Ramen
1:
~~~

Run the Schulze example with `bun run src/main.ts tally schulze lunch.txt`:

~~~text
method: schulze
ballots: 47
winner: Sushi

rank  candidate  wins  losses
   1  Sushi         4       0
   2  Tacos         3       1
   3  Ramen         2       2
   4  Pizza         1       3
   5  Salad         0       4
~~~

## Commands

`tally [--seats N] [--winner-only] METHOD FILE` counts with one method and prints its result and table. `--winner-only` omits the method details and table; `--seats` sets the STV seat count.

`compare FILE` runs all five methods for one seat and shows their winners side by side.

`pairwise [--margins] FILE` prints every head-to-head count and identifies the Condorcet winner and loser, if they exist. `--margins` prints the difference between each pair instead of the count.

## Methods

`plurality` gives a ballot to its unique first choice; a tied first group and a blank ballot give no votes.

`borda` awards each candidate points for the candidates ranked strictly below them, with unlisted candidates below listed ones and tied candidates earning no points from each other.

`schulze` compares strongest paths through the head-to-head results; candidates with no pairwise path losses are winners.

`rankedpairs` locks pairwise victories in a deterministic order, skipping any victory that would create a cycle. Winners are candidates that no other candidate can reach through the locked victories.

`stv` elects multiple winners with a quota and an exact-fraction surplus transfer. If nobody reaches the quota, it eliminates the candidate with the fewest votes; ties are resolved by candidate order.

## Exit codes

`0` means success: tally found no tie, compare found the same sole winner for every method, or pairwise found a Condorcet winner. `1` is a negative result: a tally tie, no unanimous single-winner agreement in compare, or no Condorcet winner in pairwise. `2` means an input or command error (`VoteError`): stdout is empty and `ranktally: MESSAGE` is written to stderr with a trailing LF.

## Development

Run the project checks from the repository directory:

- `bun run typecheck`
- `bun run lint`
- `bun test`

Released under the MIT license, see [LICENSE](LICENSE).

---

Built with BAKED
