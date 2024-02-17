# Bun Publish

Publish packages to npm registry with [Bun](https://bun.sh/)

## Usage

```
bunx @morlay/bunpublish
```

* skip publish package when `private: true`.
* skip publish package when version not changed.
* publish all sub packages when `workspaces` exists.
* only support token
    * reuse `install.registry.token` and `install.scopes."*".token`
* publish life cycle scripts:
    * `prepublishOnly`
    * `prepublish`
    * `prepare`
    * `prepack`
    * `postpack`
    * `publish`
    * `postpublish`

## CLI Options:

* `--tag` publish with tag, default is `latest`
* `--access` publish with access, default is `public`