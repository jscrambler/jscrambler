# Jscrambler Github Action

This action lets you protect your source code with Jscrambler.

## Inputs

### `access-key`

**Required** Your Jscrambler access key.

### `secret-key`

**Required** Your Jscrambler secret key.

### `application-id`

**Required** The Jscrambler Application ID of your application.

## Outputs

### `success`

Whether the protection was successful.

### `source code`

**Required** Your Jscrambler protected source code.

## Example usage

```yaml
uses: actions/jscrambler-github-action@v1.1
with:
  access-key: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  secret-key: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  application-id: 'ABC123GHI123MNO123TUV123'
```
