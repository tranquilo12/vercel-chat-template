"use client";

import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import cx from "classnames";
import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { User } from "next-auth";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { Chat } from "@/db/schema";
import { fetcher, getTitleFromChat } from "@/lib/utils";
import { Fork } from "@/types/fork";

import {
  InfoIcon,
  MenuIcon,
  MoreHorizontalIcon,
  PencilEditIcon,
  TrashIcon,
} from "./icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";

export const History = ({ user }: { user: User | undefined }) => {
  const { id, forkId } = useParams();
  const pathname = usePathname();
  const [expandedChats, setExpandedChats] = useState<Set<string>>(new Set());
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleteFork, setIsDeleteFork] = useState(false);

  const {
    data: history,
    isLoading,
    mutate,
  } = useSWR<Array<Chat>>(user ? "/api/history" : null, fetcher, {
    fallbackData: [],
    onSuccess: (data) => {
      console.log('Fetched history:', data);
    },
  });

  // Fetch forks for each chat
  const { data: forksByChat } = useSWR<Record<string, Fork[]>>(
    user && history?.length ? `/api/fork` : null,
    async () => {
      const forks: Record<string, Fork[]> = {};
      for (const chat of history || []) {
        try {
          const res = await fetch(`/api/fork?chatId=${chat.id}`);
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          const data = await res.json();
          forks[chat.id] = data.forks;
        } catch (error) {
          console.error(`Failed to fetch forks for chat ${chat.id}:`, error);
          forks[chat.id] = [];
        }
      }
      return forks;
    }
  );

  const toggleChatExpansion = (chatId: string) => {
    setExpandedChats(prev => {
      const next = new Set(prev);
      if (next.has(chatId)) {
        next.delete(chatId);
      } else {
        next.add(chatId);
      }
      return next;
    });
  };

  const handleDelete = async () => {
    const endpoint = isDeleteFork
      ? `/api/fork?id=${deleteId}`
      : `/api/chat?id=${deleteId}`;

    const deletePromise = fetch(endpoint, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: deleteId }),
    });

    toast.promise(deletePromise, {
      loading: `Deleting ${isDeleteFork ? 'fork' : 'chat'}...`,
      success: () => {
        mutate();
        return `${isDeleteFork ? 'Fork' : 'Chat'} deleted successfully`;
      },
      error: `Failed to delete ${isDeleteFork ? 'fork' : 'chat'}`,
    });

    setShowDeleteDialog(false);
  };

  return (
    <>
      <Button
        variant="outline"
        className="p-1.5 h-fit"
        onClick={() => setIsHistoryVisible(true)}
      >
        <MenuIcon />
      </Button>

      <Sheet open={isHistoryVisible} onOpenChange={setIsHistoryVisible}>
        <SheetContent side="left" className="p-3 w-80 bg-muted">
          <SheetHeader>
            <VisuallyHidden.Root>
              <SheetTitle className="text-left">History</SheetTitle>
              <SheetDescription className="text-left">
                {history === undefined ? "loading" : history.length} chats
              </SheetDescription>
            </VisuallyHidden.Root>
          </SheetHeader>

          <div className="text-sm flex flex-row items-center justify-between">
            <div className="flex flex-row gap-2">
              <div className="dark:text-zinc-300">History</div>

              <div className="dark:text-zinc-400 text-zinc-500">
                {history === undefined ? "loading" : history.length} chats
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col">
            {user && (
              <Button
                className="font-normal text-sm flex flex-row justify-between"
                asChild
              >
                <Link href="/">
                  <div>Start a new chat</div>
                  <PencilEditIcon size={14} />
                </Link>
              </Button>
            )}

            <div className="flex flex-col overflow-y-scroll p-1 h-[calc(100dvh-124px)]">
              {!user ? (
                <div className="text-zinc-500 h-dvh w-full flex flex-row justify-center items-center text-sm gap-2">
                  <InfoIcon />
                  <div>Login to save and revisit previous chats!</div>
                </div>
              ) : null}

              {!isLoading && history?.length === 0 && user ? (
                <div className="text-zinc-500 h-dvh w-full flex flex-row justify-center items-center text-sm gap-2">
                  <InfoIcon />
                  <div>No chats found</div>
                </div>
              ) : null}

              {isLoading && user ? (
                <div className="flex flex-col">
                  {[44, 32, 28, 52].map((item) => (
                    <div key={item} className="p-2 my-[2px]">
                      <div
                        className={`w-${item} h-[20px] rounded-md bg-zinc-200 dark:bg-zinc-600 animate-pulse`}
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              {history &&
                history.map((chat) => (
                  <div key={chat.id} className="flex flex-col">
                    <div
                      className={cx(
                        "flex flex-row items-center gap-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md pr-2",
                        { "bg-zinc-200 dark:bg-zinc-700": chat.id === id && !forkId }
                      )}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={() => toggleChatExpansion(chat.id)}
                      >
                        {expandedChats.has(chat.id) ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        className={cx(
                          "justify-between p-0 text-sm font-normal flex flex-row items-center gap-2 pr-2 w-full transition-none",
                        )}
                        asChild
                      >
                        <Link
                          href={`/chat/${chat.id}`}
                          className="text-ellipsis overflow-hidden text-left py-2 pl-2 rounded-lg outline-zinc-900"
                        >
                          {getTitleFromChat(chat)}
                        </Link>
                      </Button>

                      <DropdownMenu modal={true}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            className="p-0 h-fit font-normal text-zinc-500 transition-none hover:bg-zinc-200 dark:hover:bg-zinc-700"
                            variant="ghost"
                          >
                            <MoreHorizontalIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="left" className="z-[60]">
                          <DropdownMenuItem asChild>
                            <Button
                              className="flex flex-row gap-2 items-center justify-start w-full h-fit font-normal p-1.5 rounded-sm"
                              variant="ghost"
                              onClick={() => {
                                if (typeof chat.id === 'string') {
                                  setDeleteId(chat.id);
                                  setIsDeleteFork(false);
                                  setShowDeleteDialog(true);
                                } else {
                                  console.error('Invalid chat.id:', chat.id);
                                }
                              }}
                            >
                              <TrashIcon />
                              <div>Delete</div>
                            </Button>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {/* Forks Section */}
                    {expandedChats.has(chat.id) && forksByChat && forksByChat[chat.id]?.length > 0 && (
                      <div className="ml-6 mt-1 space-y-1">
                        {forksByChat[chat.id]?.map((fork) => (
                          <div
                            key={fork.id}
                            className={cx(
                              "flex flex-row items-center gap-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md pr-2",
                              { "bg-zinc-200 dark:bg-zinc-700": fork.id === forkId }
                            )}
                          >
                            <Button
                              variant="ghost"
                              className="justify-between p-0 text-sm font-normal flex flex-row items-center gap-2 pr-2 w-full transition-none"
                              asChild
                            >
                              <Link
                                href={`/chat/${chat.id}/fork/${fork.id}`}
                                className="text-ellipsis overflow-hidden text-left py-2 pl-2 rounded-lg outline-zinc-900"
                              >
                                {fork.title || `Fork ${new Date(fork.createdAt).toLocaleDateString()}`}
                              </Link>
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6"
                              onClick={() => {
                                if (typeof fork.id === 'string') {
                                  setDeleteId(fork.id);
                                  setIsDeleteFork(true);
                                  setShowDeleteDialog(true);
                                } else {
                                  console.error('Invalid fork.id:', fork.id);
                                }
                              }}
                            >
                              <TrashIcon size={14} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              {isDeleteFork ? ' fork' : ' chat'} and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
