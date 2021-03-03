This is a guide to the different term syntax options available. Internally,
FrankerFaceZ converts your highlight and block terms into regular
expressions.


### Types

#### 1. Text

Text has no special behavior. Any characters with special meaning in regular
expressions are escaped.


#### 2. Glob

[Globs](https://en.wikipedia.org/wiki/Glob_(programming)) provide simple, easy
to write pattern matching with wildcard characters. For example, the glob
`cir*` would match all words starting with the letters `cir`, including just
`cir` by itself. The `*` is a wildcard matching any number of characters.

| Wildcard | Description | Example | Matches | Does Not Match |
| :------: | :---------- | :-----: | :-----: | :------------: |
| `*` | Matches any number of non-space characters, including none. | `cir*` | `cir`, `circle`, `cirFairy`, `circumstance` | `ci`, `sir`, `pizza` |
| `**` | Matches any number of any characters, including none. Unlike a single `*`, this will match space characters. | `hello**!` | `hello!`, `hello, streamer!` |
| `?` | Matches any single character. | `?at` | `cat`, `hat`, `pat` | `at`
| `[abc]` | Matches one character from within the brackets. | `[cp]at` | `cat`, `pat` | `hat`, `at`
| `[a-z]` | Matches one character from the range within the brackets. | `Kappa[0-9]` | `Kappa1`, `Kappa2`, ... `Kappa0` | `Kappa`, `KappaHD`
| `[!abc]` | Matches one character that is *not* within the brackets. | `[!cp]at` | `bat`, `rat`, `hat` | `at`, `cat`, `pat`
| `[!a-z]` | Matches one character that is *not* within the range within the brackets. | `Kappa[!0-9]` | `Kappa?`, `KappaF` | `Kappa`, `Kappa0`, `Kappa4`
| `'{'abc,d?f'}'` | Matches one of the possibilities from a comma-separated list. | `cir'{'no,Fairy'}'` | `cirno`, `cirFairy` | `cir`, `circle`


#### 3. Regex

[Regular Expressions](https://en.wikipedia.org/wiki/Regular_expression) are complex
pattern strings used in programming. They are meant for advanced users.

FrankerFaceZ uses your browser's built-in engine for handling regular expressions,
with all the limitations that come with it. Regex terms are packaged into the
generated regular expressions the same as both other modes. You should not and can
not use capture groups.

FrankerFaceZ uses rudimentary logic to ensure your regular expression is not
catastrophically slow, but you should still be careful to avoid slow expressions
as they are run frequently.


### Modes

#### Case Sensitive

This attempts to match your term in a case-sensitive manner. Effectively, this
option disables the `/i` flag on the generated regular expression. Due to
limitations in your browser's regex engine, case insensitivity may not work on
some characters.


#### Match Whole Word

This requires that your term is an entire word. For example, the term `test`
without "Match Whole Word" could just as easily match `testing` or `tested`
as it matches `test`. With "Match Whole Word" enabled, it will **only** match
`test`.

This is done by wrapping the generated regular expression in extra pattern
matchers for non-word characters, such as spaces and punctuation.


#### Highlight Matches

When this is enabled, and the matching setting in [Chat > Filtering > General](~)
is enabled, any matched terms will be highlighted in chat so you can see what
exactly matched your term.

Any matches will not be displayed as emotes, links, etc.

This is a bit slower than not highlighting the match, so you may wish to only use
this when testing and then disable it when you know your term works how you wish.
