# GitHub Push Notes

This repository is already initialized as a Git repository.

Current branch:

```sh
main
```

Current remote:

```sh
origin git@github.com:vantu03/MobiArmy2-Client.git
```

Unity client project path:

```text
unity/army2-unity-client
```

Useful commands:

```sh
git status
git add .gitignore .gitattributes CSHARP_MIGRATION_PLAN.md GITHUB_PUSH.md unity/army2-unity-client
git commit -m "Add Unity C# client migration scaffold"
git push origin main
```

If you want to push to a new GitHub repository instead:

```sh
git remote set-url origin git@github.com:<user>/<repo>.git
git push -u origin main
```

Do not run `git init` inside `unity/army2-unity-client`; it should stay part of this parent repository.
